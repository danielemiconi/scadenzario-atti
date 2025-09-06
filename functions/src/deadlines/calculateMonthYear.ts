import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const calculateMonthYear = async (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext
) => {
  const newData = change.after.data();
  
  if (!newData) {
    return null; // Document was deleted
  }

  // Use statusDate as primary, hearingDate as fallback
  const statusDate = newData.statusDate;
  const hearingDate = newData.hearingDate;
  
  let dateToUse = statusDate || hearingDate;
  if (!dateToUse) {
    console.error('No statusDate or hearingDate found for deadline');
    return null;
  }

  // Convert Firestore Timestamp to Date
  const date = dateToUse.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const calculatedMonthYear = `${year}-${month}`;

  // Only update if monthYear is different
  if (newData.monthYear !== calculatedMonthYear) {
    try {
      await change.after.ref.update({
        monthYear: calculatedMonthYear,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Updated monthYear to ${calculatedMonthYear} for deadline ${context.params.deadlineId}`);
    } catch (error) {
      console.error('Error updating monthYear:', error);
    }
  }

  return null;
};