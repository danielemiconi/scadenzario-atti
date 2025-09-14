import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email } = user;

  if (!email) {
    console.log('User created without email, skipping provisioning');
    return;
  }

  const db = admin.firestore();

  try {
    // Create basic user profile
    const userProfileData = {
      uid,
      email,
      name: user.displayName || '',
      initials: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).set(userProfileData);

    // Check for pending invitations
    const pendingInvitesSnapshot = await db
      .collection('pendingInvites')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .get();

    if (!pendingInvitesSnapshot.empty) {
      const batch = db.batch();
      const tenantIds: string[] = [];

      // Process all pending invitations
      for (const inviteDoc of pendingInvitesSnapshot.docs) {
        const invite = inviteDoc.data();
        const { tenantId, role, invitedBy } = invite;

        // Add user to tenant
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
          invitedBy,
          invitedAt: invite.invitedAt
        });

        // Mark invitation as accepted
        batch.update(inviteDoc.ref, {
          status: 'accepted',
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          acceptedBy: uid
        });

        tenantIds.push(tenantId);
      }

      await batch.commit();

      // Set custom claims with all tenant memberships
      if (tenantIds.length > 0) {
        await admin.auth().setCustomUserClaims(uid, {
          tenants: tenantIds
        });

        // Update user profile with default tenant
        await db.collection('users').doc(uid).update({
          defaultTenant: tenantIds[0],
          lastSelectedTenant: tenantIds[0]
        });
      }

      console.log(`User ${email} provisioned with ${tenantIds.length} tenant(s)`);
    } else {
      // No pending invitations - check if this is the super admin
      if (email === 'daniele.miconi@iblegal.it') {
        // Super admin - always gets access
        const defaultTenantRef = db.collection('tenants').doc('default');
        const tenantDoc = await defaultTenantRef.get();

        // Create default tenant if it doesn't exist
        if (!tenantDoc.exists) {
          await defaultTenantRef.set({
            name: 'Studio Legale IBLegal',
            plan: 'pro',
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: uid
          });
        }

        // Add super admin to tenant
        await defaultTenantRef.collection('users').doc(uid).set({
          uid,
          role: 'admin',
          status: 'active',
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Set custom claims
        await admin.auth().setCustomUserClaims(uid, {
          tenants: ['default'],
          role: 'admin' // Legacy support
        });

        // Update user profile
        await db.collection('users').doc(uid).update({
          defaultTenant: 'default',
          lastSelectedTenant: 'default',
          role: 'admin' // Legacy support
        });

        console.log(`Super admin ${email} provisioned`);
      } else {
        // Regular user without invitation - no tenant access
        console.log(`User ${email} created but has no tenant access (needs invitation)`);

        // Still set empty tenants claim to avoid errors
        await admin.auth().setCustomUserClaims(uid, {
          tenants: []
        });
      }
    }

  } catch (error) {
    console.error('Error in onUserCreate:', error);
    // Don't throw - let user creation succeed even if provisioning fails
  }
});