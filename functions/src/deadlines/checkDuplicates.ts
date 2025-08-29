import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const checkDuplicates = async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const data = snapshot.data();
  if (!data) return null;

  const { court, rg, actType, hearingDate } = data;

  // Build composite key
  const compositeKey = `${court}_${rg}_${actType}_${hearingDate.toDate().toISOString()}`;

  try {
    // Check for existing deadlines with same composite key
    const duplicates = await admin
      .firestore()
      .collection('deadlines')
      .where('court', '==', court)
      .where('rg', '==', rg)
      .where('actType', '==', actType)
      .where('hearingDate', '==', hearingDate)
      .where('deleted', '==', false)
      .get();

    // If more than 1 document exists (including the current one), it's a duplicate
    if (duplicates.size > 1) {
      console.warn(`Duplicate deadline detected: ${compositeKey}`);
      
      // Mark the new document as duplicate
      await snapshot.ref.update({
        isDuplicate: true,
        duplicateKey: compositeKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the duplicate detection
      await admin.firestore().collection('auditLogs').add({
        action: 'duplicate_detected',
        collection: 'deadlines',
        documentId: context.params.deadlineId,
        details: { compositeKey },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error checking for duplicates:', error);
  }

  return null;
};