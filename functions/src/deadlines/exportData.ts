import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const exportData = async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  // Check if user is admin
  const callerToken = context.auth.token;
  if (callerToken.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can export data'
    );
  }

  const { format = 'csv', monthYear, includeArchived = false } = data;

  try {
    // Build query
    let query = admin
      .firestore()
      .collection('deadlines')
      .where('deleted', '==', false);

    if (!includeArchived) {
      query = query.where('archived', '==', false);
    }

    if (monthYear) {
      query = query.where('monthYear', '==', monthYear);
    }

    const snapshot = await query.orderBy('hearingDate', 'asc').get();

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Iniziali',
        'Pratica',
        'Ufficio',
        'RG',
        'Tipo Atto',
        'Data Udienza',
        'Stato',
        'Data Stato',
        'Note',
        'Archiviato',
      ];

      const rows = [headers.join(';')];

      snapshot.forEach((doc) => {
        const deadline = doc.data();
        const row = [
          deadline.ownerInitials || '',
          sanitizeForCSV(deadline.matter || ''),
          sanitizeForCSV(deadline.court || ''),
          deadline.rg || '',
          sanitizeForCSV(deadline.actType || ''),
          formatDate(deadline.hearingDate),
          deadline.status || '',
          deadline.statusDate ? formatDate(deadline.statusDate) : '',
          sanitizeForCSV(deadline.notes || ''),
          deadline.archived ? 'SI' : 'NO',
        ];
        rows.push(row.join(';'));
      });

      const csvContent = rows.join('\n');

      // Log export action
      await admin.firestore().collection('auditLogs').add({
        action: 'export_data',
        collection: 'deadlines',
        documentId: null,
        details: { 
          format, 
          monthYear, 
          includeArchived,
          recordCount: snapshot.size 
        },
        userId: context.auth.uid,
        userEmail: callerToken.email,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return csvContent;
    } else {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Unsupported export format'
      );
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error exporting data'
    );
  }
};

function sanitizeForCSV(value: string): string {
  // Escape quotes and wrap in quotes if contains delimiter
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(timestamp: admin.firestore.Timestamp): string {
  const date = timestamp.toDate();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}