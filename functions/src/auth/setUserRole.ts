import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const setUserRole = async (data: any, context: functions.https.CallableContext) => {
  // Check if user is authenticated and is an admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const callerToken = context.auth.token;
  if (callerToken.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can set user roles'
    );
  }

  const { uid, role } = data;

  if (!uid || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'uid and role are required'
    );
  }

  if (role !== 'admin' && role !== 'standard') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Role must be either admin or standard'
    );
  }

  try {
    // Set custom claims
    await admin.auth().setCustomUserClaims(uid, { role });

    // Log the action
    await admin.firestore().collection('auditLogs').add({
      action: 'update_role',
      collection: 'users',
      documentId: uid,
      before: { role: 'unknown' },
      after: { role },
      userId: context.auth.uid,
      userEmail: callerToken.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: `Role ${role} assigned to user ${uid}` };
  } catch (error) {
    console.error('Error setting user role:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error setting user role'
    );
  }
};