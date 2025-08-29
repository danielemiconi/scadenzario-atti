import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface ArchiveDeadlineRequest {
  deadlineId: string;
  archived: boolean; // true to archive, false to restore
}

export const archiveDeadline = async (
  data: ArchiveDeadlineRequest, 
  context: functions.https.CallableContext
) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to archive/restore deadlines.'
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
  const isAdmin = userData?.role === 'admin';

  // Only admins can archive/restore for now (can be expanded later)
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can archive/restore deadlines.'
    );
  }

  const { deadlineId, archived } = data;

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

    // Prepare update data
    const updateData: any = {
      archived: archived,
      updatedBy: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (archived) {
      updateData.archivedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.archivedBy = context.auth.uid;
    } else {
      // When restoring, remove archived timestamp and user
      updateData.archivedAt = admin.firestore.FieldValue.delete();
      updateData.archivedBy = admin.firestore.FieldValue.delete();
    }

    // Update the deadline
    await deadlineRef.update(updateData);

    console.log(`Deadline ${deadlineId} ${archived ? 'archived' : 'restored'} by ${context.auth.uid}`);

    return {
      success: true,
      message: archived ? 'Deadline archived successfully' : 'Deadline restored successfully',
      deadlineId: deadlineId
    };

  } catch (error) {
    console.error('Error archiving/restoring deadline:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while processing the request.'
    );
  }
};