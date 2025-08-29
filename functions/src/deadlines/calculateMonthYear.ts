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

  const hearingDate = newData.hearingDate;
  if (!hearingDate) {
    console.error('No hearing date found for deadline');
    return null;
  }

  // Convert Firestore Timestamp to Date
  const date = hearingDate.toDate();
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