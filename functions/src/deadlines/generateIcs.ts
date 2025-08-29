import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as ical from 'ical-generator';

export const generateIcs = async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { deadlineId, monthYear } = data;

  if (!deadlineId && !monthYear) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Either deadlineId or monthYear is required'
    );
  }

  try {
    let deadlines: admin.firestore.DocumentData[] = [];

    if (deadlineId) {
      // Generate ICS for single deadline
      const deadlineDoc = await admin
        .firestore()
        .collection('deadlines')
        .doc(deadlineId)
        .get();

      if (!deadlineDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Deadline not found'
        );
      }

      deadlines = [deadlineDoc.data()!];
    } else if (monthYear) {
      // Generate ICS for all deadlines in a month
      const snapshot = await admin
        .firestore()
        .collection('deadlines')
        .where('monthYear', '==', monthYear)
        .where('deleted', '==', false)
        .where('archived', '==', false)
        .get();

      deadlines = snapshot.docs.map(doc => doc.data());
    }

    // Create calendar
    const cal = ical.default({
      name: 'Scadenzario Atti',
      timezone: 'Europe/Rome',
    });

    // Add events for each deadline
    for (const deadline of deadlines) {
      const hearingDate = deadline.hearingDate.toDate();
      
      cal.createEvent({
        start: hearingDate,
        end: new Date(hearingDate.getTime() + 60 * 60 * 1000), // 1 hour duration
        summary: `${deadline.actType} - RG ${deadline.rg}`,
        description: `Pratica: ${deadline.matter}\nUfficio: ${deadline.court}\nRG: ${deadline.rg}\nTipo: ${deadline.actType}${deadline.notes ? '\nNote: ' + deadline.notes : ''}`,
        location: deadline.court,
        categories: [{name: 'Scadenza Atto'}],
        alarms: [
          {
            type: ical.ICalAlarmType.display,
            trigger: 24 * 60 * 60, // 1 day before
            description: 'Promemoria scadenza atto domani',
          },
          {
            type: ical.ICalAlarmType.display,
            trigger: 7 * 24 * 60 * 60, // 7 days before
            description: 'Promemoria scadenza atto tra una settimana',
          },
        ],
      });
    }

    // Generate ICS string
    const icsContent = cal.toString();

    return { 
      success: true, 
      icsContent,
      filename: deadlineId 
        ? `atto_${deadlineId}.ics` 
        : `scadenze_${monthYear}.ics`
    };
  } catch (error) {
    console.error('Error generating ICS:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error generating calendar file'
    );
  }
};