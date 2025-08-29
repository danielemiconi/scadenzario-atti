import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const auditLogger = async (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext
) => {
  const { collection, docId } = context.params;
  
  // Skip audit logs for audit logs collection to prevent infinite loop
  if (collection === 'auditLogs') {
    return null;
  }

  // Skip certain collections that don't need auditing
  const skipCollections = ['notifications', 'sessions'];
  if (skipCollections.includes(collection)) {
    return null;
  }

  const beforeData = change.before.exists ? change.before.data() : null;
  const afterData = change.after.exists ? change.after.data() : null;

  let action: 'create' | 'update' | 'delete';
  if (!beforeData) {
    action = 'create';
  } else if (!afterData) {
    action = 'delete';
  } else {
    action = 'update';
  }

  try {
    // Determine user ID from document data
    let userId = null;
    let userEmail = null;
    
    if (afterData) {
      userId = afterData.updatedBy || afterData.createdBy || null;
    } else if (beforeData) {
      userId = beforeData.updatedBy || beforeData.createdBy || null;
    }

    // Try to get user email if we have userId
    if (userId) {
      try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (userDoc.exists) {
          userEmail = userDoc.data()?.email || null;
        }
      } catch (error) {
        console.error('Error fetching user data for audit log:', error);
      }
    }

    // Create audit log entry
    const auditEntry = {
      action,
      collection,
      documentId: docId,
      before: sanitizeData(beforeData),
      after: sanitizeData(afterData),
      userId: userId || 'system',
      userEmail: userEmail || 'unknown',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin.firestore().collection('auditLogs').add(auditEntry);
    
    console.log(`Audit log created for ${action} on ${collection}/${docId}`);
  } catch (error) {
    console.error('Error creating audit log:', error);
  }

  return null;
};

function sanitizeData(data: any): any {
  if (!data) return null;
  
  // Create a copy to avoid modifying original
  const sanitized = { ...data };
  
  // Remove sensitive fields that shouldn't be logged
  const sensitiveFields = ['password', 'passwordHash', 'token', 'secret'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  // Limit string lengths to prevent excessive log size
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
      sanitized[key] = sanitized[key].substring(0, 500) + '...[truncated]';
    }
  });
  
  return sanitized;
}