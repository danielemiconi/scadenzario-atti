import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface PermanentlyDeleteRequest {
  deadlineId: string;
}

export const permanentlyDelete = async (
  data: PermanentlyDeleteRequest, 
  context: functions.https.CallableContext
) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to permanently delete deadlines.'
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

  // Only admins can permanently delete
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can permanently delete deadlines.'
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

    // Check if it's in trash (deleted)
    if (currentData?.deleted !== true) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Only items in trash can be permanently deleted.'
      );
    }

    // Permanently delete the document
    await deadlineRef.delete();

    console.log(`Deadline ${deadlineId} permanently deleted by ${context.auth.uid}`);

    return {
      success: true,
      message: 'Atto eliminato definitivamente',
      deadlineId: deadlineId
    };

  } catch (error) {
    console.error('Error permanently deleting deadline:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while processing the request.'
    );
  }
};