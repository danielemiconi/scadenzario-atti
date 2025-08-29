import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface EmptyTrashRequest {
  confirm?: boolean; // Extra safety check
}

export const emptyTrash = async (
  data: EmptyTrashRequest, 
  context: functions.https.CallableContext
) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to empty trash.'
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

  // Only admins can empty trash
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can empty trash.'
    );
  }

  // Safety check
  if (!data.confirm) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Confirmation required to empty trash.'
    );
  }

  try {
    // Get all deleted deadlines
    const deletedDeadlinesSnapshot = await admin.firestore()
      .collection('deadlines')
      .where('deleted', '==', true)
      .get();

    if (deletedDeadlinesSnapshot.empty) {
      return {
        success: true,
        message: 'Il cestino è già vuoto',
        deletedCount: 0
      };
    }

    // Delete all documents in batches
    const batch = admin.firestore().batch();
    let deletedCount = 0;

    deletedDeadlinesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Commit the batch
    await batch.commit();

    console.log(`Trash emptied: ${deletedCount} deadlines permanently deleted by ${context.auth.uid}`);

    return {
      success: true,
      message: `Cestino svuotato: ${deletedCount} atti eliminati definitivamente`,
      deletedCount: deletedCount
    };

  } catch (error) {
    console.error('Error emptying trash:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while processing the request.'
    );
  }
};