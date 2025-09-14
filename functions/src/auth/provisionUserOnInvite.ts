import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface InviteData {
  email: string;
  tenantId: string;
  role: 'admin' | 'editor' | 'viewer';
  invitedBy: string;
}

export const provisionUserOnInvite = async (
  data: InviteData,
  context: functions.https.CallableContext
) => {
  // Verify the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to invite users'
    );
  }

  const { email, tenantId, role, invitedBy } = data;

  // Validate input
  if (!email || !tenantId || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email, tenantId, and role are required'
    );
  }

  // Verify the inviter has admin role in the tenant
  const inviterTenantDoc = await admin.firestore()
    .collection('tenants')
    .doc(tenantId)
    .collection('users')
    .doc(context.auth.uid)
    .get();

  if (!inviterTenantDoc.exists || inviterTenantDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only tenant admins can invite users'
    );
  }

  try {
    // Check if user exists in Firebase Auth
    let uid: string;

    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist, will need to sign up
        // Create a pending invitation document
        const inviteRef = await admin.firestore()
          .collection('pendingInvites')
          .add({
            email,
            tenantId,
            role,
            invitedBy: invitedBy || context.auth.uid,
            invitedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
          });

        return {
          success: true,
          userExists: false,
          inviteId: inviteRef.id,
          message: `Invitation sent to ${email}. They need to sign up to accept.`
        };
      }
      throw error;
    }

    // User exists, add them to the tenant
    const db = admin.firestore();
    const batch = db.batch();

    // Add user to tenant users collection
    const tenantUserRef = db
      .collection('tenants')
      .doc(tenantId)
      .collection('users')
      .doc(uid);

    batch.set(tenantUserRef, {
      uid,
      role,
      status: 'active',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      invitedBy: invitedBy || context.auth.uid,
      invitedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Update user's custom claims to include the new tenant
    const currentClaims = (await admin.auth().getUser(uid)).customClaims || {};
    const currentTenants = currentClaims.tenants || [];

    if (!currentTenants.includes(tenantId)) {
      currentTenants.push(tenantId);
      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        tenants: currentTenants
      });
    }

    // Send notification email (optional - implement based on your email service)
    // await sendInvitationEmail(email, tenantId, role);

    return {
      success: true,
      userExists: true,
      uid,
      message: `${email} è stato aggiunto al tenant con successo`
    };

  } catch (error) {
    console.error('Error provisioning user:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to provision user'
    );
  }
};