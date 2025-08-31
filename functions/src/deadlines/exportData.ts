import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const exportData = async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  // Check if user is admin - first check custom claims, then fallback to database
  const callerToken = context.auth.token;
  let isAdmin = callerToken.role === 'admin';
  
  // If no custom claims, check database
  if (!isAdmin) {
    try {
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(context.auth.uid)
        .get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        isAdmin = userData?.role === 'admin';
      }
      
      // Special admin bypass for specific email
      if (!isAdmin && callerToken.email === 'daniele.miconi@iblegal.it') {
        isAdmin = true;
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  }
  
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can export data'
    );
  }

  const { 
    format = 'csv', 
    monthYear, 
    includeArchived = false,
    status,
    ownerInitials,
    court,
    startDate,
    endDate,
    includeColumns = []
  } = data;

  try {
    console.log('Starting export with parameters:', {
      format,
      monthYear: monthYear || 'none',
      status: status || 'none',
      ownerInitials: ownerInitials || 'none',
      court: court || 'none',
      startDate: startDate || 'none',
      endDate: endDate || 'none',
      includeArchived,
      columnsCount: includeColumns?.length || 0
    });

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

    if (status) {
      query = query.where('status', '==', status);
    }

    if (ownerInitials) {
      query = query.where('ownerInitials', '==', ownerInitials);
    }

    if (court) {
      query = query.where('court', '==', court);
    }

    console.log('Executing Firestore query...');
    let snapshot = await query.orderBy('hearingDate', 'asc').get();
    console.log(`Initial query returned ${snapshot.size} documents`);

    // Client-side filtering for date ranges (since Firestore doesn't support complex range queries)
    let filteredDocs = snapshot.docs;
    
    if (startDate || endDate) {
      filteredDocs = snapshot.docs.filter(doc => {
        const data = doc.data();
        const hearingDate = data.hearingDate?.toDate();
        
        if (!hearingDate) return false;
        
        if (startDate) {
          const start = new Date(startDate);
          if (hearingDate < start) return false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Include the entire end date
          if (hearingDate > end) return false;
        }
        
        return true;
      });
      console.log(`After date filtering: ${filteredDocs.length} documents`);
    }

    if (format === 'csv') {
      // Define all possible columns
      const allColumns = {
        'ownerInitials': 'Iniziali',
        'matter': 'Pratica',
        'court': 'Ufficio',
        'forum': 'Foro',
        'rg': 'RG',
        'actType': 'Tipo Atto',
        'hearingDate': 'Data Udienza',
        'status': 'Stato',
        'statusDate': 'Data Stato',
        'notes': 'Note',
        'archived': 'Archiviato',
        'createdBy': 'Creato Da',
        'updatedBy': 'Modificato Da',
        'createdAt': 'Data Creazione',
        'updatedAt': 'Data Modifica'
      };

      // Use requested columns or default set
      const columnsToExport = includeColumns.length > 0 ? includeColumns : 
        ['ownerInitials', 'matter', 'court', 'rg', 'actType', 'hearingDate', 'status', 'statusDate', 'notes', 'archived'];

      const headers = columnsToExport.map((col: string) => allColumns[col as keyof typeof allColumns] || col);
      const rows = [headers.join(';')];

      filteredDocs.forEach((doc) => {
        const deadline = doc.data();
        const row = columnsToExport.map((col: string) => {
          switch (col) {
            case 'ownerInitials':
              return deadline.ownerInitials || '';
            case 'matter':
              return sanitizeForCSV(deadline.matter || '');
            case 'court':
              return sanitizeForCSV(deadline.court || '');
            case 'forum':
              return sanitizeForCSV(deadline.forum || '');
            case 'rg':
              return deadline.rg || '';
            case 'actType':
              return sanitizeForCSV(deadline.actType || '');
            case 'hearingDate':
              return deadline.hearingDate ? formatDate(deadline.hearingDate) : '';
            case 'status':
              return deadline.status || '';
            case 'statusDate':
              return deadline.statusDate ? formatDate(deadline.statusDate) : '';
            case 'notes':
              return sanitizeForCSV(deadline.notes || '');
            case 'archived':
              return deadline.archived ? 'SI' : 'NO';
            case 'createdBy':
              return deadline.createdBy || '';
            case 'updatedBy':
              return deadline.updatedBy || '';
            case 'createdAt':
              return deadline.createdAt ? formatDate(deadline.createdAt) : '';
            case 'updatedAt':
              return deadline.updatedAt ? formatDate(deadline.updatedAt) : '';
            default:
              return '';
          }
        });
        rows.push(row.join(';'));
      });

      const csvContent = rows.join('\n');
      console.log(`Generated CSV with ${rows.length - 1} data rows`);

      // Log export action - sanitize undefined values
      const auditDetails: any = {
        format,
        includeArchived,
        includeColumns: columnsToExport,
        recordCount: filteredDocs.length
      };

      // Only add non-empty filter parameters
      if (monthYear) auditDetails.monthYear = monthYear;
      if (status) auditDetails.status = status;
      if (ownerInitials) auditDetails.ownerInitials = ownerInitials;
      if (court) auditDetails.court = court;
      if (startDate) auditDetails.startDate = startDate;
      if (endDate) auditDetails.endDate = endDate;

      await admin.firestore().collection('auditLogs').add({
        action: 'export_data',
        collection: 'deadlines',
        documentId: null,
        details: auditDetails,
        userId: context.auth.uid,
        userEmail: callerToken.email || 'unknown',
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