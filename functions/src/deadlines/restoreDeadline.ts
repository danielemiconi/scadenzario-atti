import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface RestoreDeadlineRequest {
  deadlineId: string;
}

export const restoreDeadline = async (
  data: RestoreDeadlineRequest, 
  context: functions.https.CallableContext
) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to restore deadlines.'
    );
  }

  // Get user data to check role
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(context.auth.uid)
    .get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'User profile not found.'
    );
  }

  const userData = userDoc.data();
  const isAdmin = userData?.role === 'admin' || context.auth.token.email === 'daniele.miconi@iblegal.it';

  // Only admins can restore deadlines
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can restore deadlines.'
    );
  }

  const { deadlineId } = data;

  if (!deadlineId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Deadline ID is required.'
    );
  }

  try {
    const deadlineRef = admin.firestore().collection('deadlines').doc(deadlineId);
    const deadlineDoc = await deadlineRef.get();

    if (!deadlineDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Deadline not found.'
      );
    }

    const currentData = deadlineDoc.data();

    // Check if not deleted
    if (currentData?.deleted !== true) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Deadline is not deleted.'
      );
    }

    // Restore the deadline
    const updateData = {
      deleted: false,
      deletedAt: admin.firestore.FieldValue.delete(),
      deletedBy: admin.firestore.FieldValue.delete(),
      updatedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await deadlineRef.update(updateData);

    console.log(`Deadline ${deadlineId} restored by ${context.auth.uid}`);

    return {
      success: true,
      message: 'Atto ripristinato con successo',
      deadlineId: deadlineId
    };

  } catch (error) {
    console.error('Error restoring deadline:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while processing the request.'
    );
  }
};