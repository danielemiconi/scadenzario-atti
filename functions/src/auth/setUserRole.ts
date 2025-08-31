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
  const callerEmail = callerToken.email;
  
  // Check if user is admin through multiple methods:
  // 1. Custom claims (primary method)
  // 2. Special admin bypass email
  // 3. Firestore document role (fallback)
  let isAdmin = callerToken.role === 'admin';
  
  // Special admin bypass for primary admin email
  if (callerEmail === 'daniele.miconi@iblegal.it') {
    isAdmin = true;
    console.log('Admin access granted via special email bypass');
  }
  
  // If not admin via custom claims or email bypass, check Firestore
  if (!isAdmin && context.auth.uid) {
    try {
      const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.role === 'admin') {
          isAdmin = true;
          console.log('Admin access granted via Firestore document');
        }
      }
    } catch (firestoreError) {
      console.error('Error checking user role in Firestore:', firestoreError);
    }
  }
  
  if (!isAdmin) {
    console.log(`Access denied for user ${callerEmail}: role=${callerToken.role}, uid=${context.auth.uid}`);
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