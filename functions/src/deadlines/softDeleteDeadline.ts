import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface SoftDeleteDeadlineRequest {
  deadlineId: string;
}

export const softDeleteDeadline = async (
  data: SoftDeleteDeadlineRequest, 
  context: functions.https.CallableContext
) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to delete deadlines.'
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

  // Only admins can delete deadlines
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can delete deadlines.'
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

    // Check if already deleted
    if (currentData?.deleted === true) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Deadline is already deleted.'
      );
    }

    // Soft delete the deadline
    const updateData = {
      deleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: context.auth.uid,
      updatedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await deadlineRef.update(updateData);

    console.log(`Deadline ${deadlineId} soft deleted by ${context.auth.uid}`);

    return {
      success: true,
      message: 'Atto spostato nel cestino con successo',
      deadlineId: deadlineId
    };

  } catch (error) {
    console.error('Error soft deleting deadline:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while processing the request.'
    );
  }
};