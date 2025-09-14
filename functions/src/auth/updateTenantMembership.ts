import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface UpdateMembershipData {
  userId: string;
  tenantId: string;
  action: 'add' | 'remove';
  role?: 'admin' | 'editor' | 'viewer'; // Required for 'add' action
}

export const updateTenantMembership = async (
  data: UpdateMembershipData,
  context: functions.https.CallableContext
) => {
  // Verify the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to update memberships'
    );
  }

  const { userId, tenantId, action, role } = data;

  // Validate input
  if (!userId || !tenantId || !action) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userId, tenantId, and action are required'
    );
  }

  if (action === 'add' && !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Role is required when adding a user to a tenant'
    );
  }

  // Verify the caller has admin role in the tenant
  const db = admin.firestore();
  const callerTenantDoc = await db
    .collection('tenants')
    .doc(tenantId)
    .collection('users')
    .doc(context.auth.uid)
    .get();

  if (!callerTenantDoc.exists || callerTenantDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only tenant admins can update memberships'
    );
  }

  try {
    // Get current user's custom claims
    const userRecord = await admin.auth().getUser(userId);
    const currentClaims = userRecord.customClaims || {};
    let currentTenants = currentClaims.tenants || [];

    if (action === 'add') {
      // Add user to tenant
      const tenantUserRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('users')
        .doc(userId);

      await tenantUserRef.set({
        uid: userId,
        role: role!,
        status: 'active',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        invitedBy: context.auth.uid,
        invitedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Add tenant to user's claims if not already present
      if (!currentTenants.includes(tenantId)) {
        currentTenants.push(tenantId);
      }

    } else if (action === 'remove') {
      // Remove user from tenant
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('users')
        .doc(userId)
        .delete();

      // Remove tenant from user's claims
      currentTenants = currentTenants.filter((t: string) => t !== tenantId);

      // If this was the user's default or last selected tenant, update it
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (userData?.defaultTenant === tenantId || userData?.lastSelectedTenant === tenantId) {
        const newDefaultTenant = currentTenants.length > 0 ? currentTenants[0] : null;
        await db.collection('users').doc(userId).update({
          ...(userData.defaultTenant === tenantId && { defaultTenant: newDefaultTenant }),
          ...(userData.lastSelectedTenant === tenantId && { lastSelectedTenant: newDefaultTenant })
        });
      }
    }

    // Update custom claims
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims,
      tenants: currentTenants
    });

    return {
      success: true,
      action,
      userId,
      tenantId,
      tenants: currentTenants,
      message: `User ${action === 'add' ? 'added to' : 'removed from'} tenant successfully`
    };

  } catch (error) {
    console.error('Error updating tenant membership:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to update tenant membership'
    );
  }
};