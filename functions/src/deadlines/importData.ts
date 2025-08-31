import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface ImportRow {
  ownerInitials?: string;
  matter?: string;
  court?: string;
  forum?: string;
  rg?: string;
  actType?: string;
  hearingDate?: string;
  status?: string;
  statusDate?: string;
  notes?: string;
  archived?: string;
}

interface ValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ValidationError[];
  duplicates: Array<{ row: number; existing: string }>;
  message: string;
}

export const importData = async (
  data: { csvContent: string; skipDuplicates?: boolean },
  context: functions.https.CallableContext
): Promise<ImportResult> => {
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
      'Only admins can import data'
    );
  }

  const { csvContent, skipDuplicates = true } = data;

  try {
    // Parse CSV content
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Il file CSV deve contenere almeno un header e una riga di dati'
      );
    }

    const header = lines[0].split(';').map(col => col.trim());
    const rows = lines.slice(1);

    // Column mapping from Italian headers to field names
    const columnMapping: Record<string, string> = {
      'iniziali': 'ownerInitials',
      'pratica': 'matter',
      'ufficio': 'court',
      'foro': 'forum',
      'rg': 'rg',
      'tipo atto': 'actType',
      'data udienza': 'hearingDate',
      'stato': 'status',
      'data stato': 'statusDate',
      'note': 'notes',
      'archiviato': 'archived'
    };

    // Map headers to field names
    const fieldMapping = header.map(col => {
      const normalized = col.toLowerCase().trim();
      return columnMapping[normalized] || normalized;
    });

    const validationErrors: ValidationError[] = [];
    const duplicates: Array<{ row: number; existing: string }> = [];
    const validRows: ImportRow[] = [];

    // Validate and process each row
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i].split(';').map(cell => cell.trim());
      const rowObj: ImportRow = {};

      // Map row data to object
      fieldMapping.forEach((field, index) => {
        if (rowData[index]) {
          rowObj[field as keyof ImportRow] = rowData[index];
        }
      });

      // Validate required fields
      const requiredFields = ['ownerInitials', 'matter', 'court', 'rg', 'actType', 'hearingDate'];
      let rowValid = true;

      for (const field of requiredFields) {
        if (!rowObj[field as keyof ImportRow]) {
          validationErrors.push({
            row: i + 2, // +2 because we count from 1 and skip header
            field,
            value: rowObj[field as keyof ImportRow],
            message: `Campo obbligatorio mancante: ${field}`
          });
          rowValid = false;
        }
      }

      // Validate RG format
      if (rowObj.rg && !/^[0-9]{1,6}\/[0-9]{4}$/.test(rowObj.rg)) {
        validationErrors.push({
          row: i + 2,
          field: 'rg',
          value: rowObj.rg,
          message: 'Formato RG non valido. Deve essere nel formato "numero/anno" (es. 506/2025)'
        });
        rowValid = false;
      }

      // Validate initials length (2-3 characters)
      if (rowObj.ownerInitials && (rowObj.ownerInitials.length < 2 || rowObj.ownerInitials.length > 3)) {
        validationErrors.push({
          row: i + 2,
          field: 'ownerInitials',
          value: rowObj.ownerInitials,
          message: 'Le iniziali devono essere di 2 o 3 caratteri'
        });
        rowValid = false;
      }

      // Validate date format
      if (rowObj.hearingDate && !isValidDate(rowObj.hearingDate)) {
        validationErrors.push({
          row: i + 2,
          field: 'hearingDate',
          value: rowObj.hearingDate,
          message: 'Formato data non valido. Usa DD/MM/YYYY'
        });
        rowValid = false;
      }

      if (rowValid) {
        // Check for duplicates
        const duplicateCheck = await checkForDuplicate(rowObj);
        if (duplicateCheck.exists) {
          duplicates.push({
            row: i + 2,
            existing: duplicateCheck.docId!
          });
          
          if (!skipDuplicates) {
            continue;
          }
        }
        
        validRows.push(rowObj);
      }
    }

    // If there are validation errors and we're not skipping, return them
    if (validationErrors.length > 0) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: validationErrors,
        duplicates,
        message: `Trovati ${validationErrors.length} errori di validazione`
      };
    }

    // Import valid rows
    const batch = admin.firestore().batch();
    let imported = 0;

    for (const row of validRows) {
      const docRef = admin.firestore().collection('deadlines').doc();
      const deadlineData = await convertRowToDeadline(row, context.auth.uid);
      
      batch.set(docRef, deadlineData);
      imported++;
    }

    await batch.commit();

    // Log import action
    await admin.firestore().collection('auditLogs').add({
      action: 'import_data',
      collection: 'deadlines',
      documentId: null,
      details: {
        totalRows: rows.length,
        imported,
        skipped: duplicates.length,
        errors: validationErrors.length,
        skipDuplicates
      },
      userId: context.auth.uid,
      userEmail: callerToken.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      imported,
      skipped: duplicates.length,
      errors: validationErrors,
      duplicates,
      message: `Import completato: ${imported} record importati, ${duplicates.length} duplicati saltati`
    };

  } catch (error) {
    console.error('Error importing data:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Errore durante l\'importazione dei dati'
    );
  }
};

function isValidDate(dateString: string): boolean {
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateString.match(dateRegex);
  
  if (!match) return false;
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}

function parseDate(dateString: string): admin.firestore.Timestamp {
  const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error('Invalid date format');
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  return admin.firestore.Timestamp.fromDate(new Date(year, month - 1, day));
}

async function checkForDuplicate(row: ImportRow): Promise<{ exists: boolean; docId?: string }> {
  if (!row.court || !row.rg || !row.actType || !row.hearingDate) {
    return { exists: false };
  }

  const hearingDate = parseDate(row.hearingDate);
  
  const query = admin.firestore()
    .collection('deadlines')
    .where('court', '==', row.court)
    .where('rg', '==', row.rg)
    .where('actType', '==', row.actType)
    .where('hearingDate', '==', hearingDate)
    .where('deleted', '==', false);

  const snapshot = await query.get();
  
  if (!snapshot.empty) {
    return { exists: true, docId: snapshot.docs[0].id };
  }
  
  return { exists: false };
}

async function convertRowToDeadline(row: ImportRow, userId: string): Promise<any> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const hearingDate = parseDate(row.hearingDate!);
  
  // Calculate monthYear from hearing date
  const date = hearingDate.toDate();
  const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const deadline: any = {
    monthYear,
    ownerInitials: row.ownerInitials!,
    matter: row.matter!,
    court: row.court!,
    rg: row.rg!,
    actType: row.actType!,
    hearingDate,
    archived: false,
    deleted: false,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  };

  // Optional fields
  if (row.forum) deadline.forum = row.forum;
  if (row.status) deadline.status = row.status;
  if (row.statusDate && isValidDate(row.statusDate)) {
    deadline.statusDate = parseDate(row.statusDate);
  }
  if (row.notes) deadline.notes = row.notes;
  if (row.archived) {
    deadline.archived = row.archived.toLowerCase() === 'si' || row.archived.toLowerCase() === 'true';
  }

  return deadline;
}