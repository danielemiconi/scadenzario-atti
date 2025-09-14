import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const migrateSingleTenant = async (
  data: { dryRun?: boolean },
  context: functions.https.CallableContext
) => {
  // This function should only be called by super admins
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to run migration'
    );
  }

  // Check if caller is the special admin
  if (context.auth.token.email !== 'daniele.miconi@iblegal.it') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only super admin can run migration'
    );
  }

  const { dryRun = false } = data;
  const db = admin.firestore();
  const defaultTenantId = 'default';

  console.log(`Starting migration to multi-tenant (dryRun: ${dryRun})`);

  const stats = {
    tenantCreated: false,
    usersUpdated: 0,
    usersMigrated: 0,
    deadlinesMigrated: 0,
    legendMigrated: 0,
    errors: [] as string[]
  };

  try {
    // Step 1: Create default tenant if it doesn't exist
    const tenantRef = db.collection('tenants').doc(defaultTenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      const tenantData = {
        name: 'Studio Legale',
        plan: 'pro',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: context.auth.uid
      };

      if (!dryRun) {
        await tenantRef.set(tenantData);
      }
      stats.tenantCreated = true;
      console.log('Default tenant created');
    }

    // Step 2: Migrate users to tenant membership
    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;

      try {
        // Map legacy role to tenant role
        let tenantRole: 'admin' | 'editor' | 'viewer' = 'viewer';
        if (userData.role === 'admin' || userData.email === 'daniele.miconi@iblegal.it') {
          tenantRole = 'admin';
        } else if (userData.role === 'standard') {
          tenantRole = 'editor';
        }

        // Add user to tenant users collection
        const tenantUserData = {
          uid,
          role: tenantRole,
          status: 'active',
          joinedAt: userData.createdAt || admin.firestore.FieldValue.serverTimestamp()
        };

        if (!dryRun) {
          await tenantRef.collection('users').doc(uid).set(tenantUserData);

          // Update user's custom claims
          try {
            const currentUser = await admin.auth().getUser(uid);
            const currentClaims = currentUser.customClaims || {};

            await admin.auth().setCustomUserClaims(uid, {
              ...currentClaims,
              tenants: [defaultTenantId]
            });
          } catch (authError) {
            console.warn(`Could not update claims for user ${uid}:`, authError);
          }

          // Update user profile with default tenant
          await userDoc.ref.update({
            defaultTenant: defaultTenantId,
            lastSelectedTenant: defaultTenantId
          });
        }

        stats.usersMigrated++;
      } catch (error) {
        stats.errors.push(`Failed to migrate user ${uid}: ${error}`);
      }
    }

    // Step 3: Migrate deadlines
    const deadlinesSnapshot = await db.collection('deadlines').get();
    const deadlineBatch = db.batch();
    let deadlineBatchCount = 0;

    for (const deadlineDoc of deadlinesSnapshot.docs) {
      const deadlineData = deadlineDoc.data();
      const newDeadlineRef = db
        .collection('tenants')
        .doc(defaultTenantId)
        .collection('deadlines')
        .doc(deadlineDoc.id);

      if (!dryRun) {
        deadlineBatch.set(newDeadlineRef, deadlineData);
        deadlineBatchCount++;

        // Commit batch every 400 documents (Firestore limit is 500)
        if (deadlineBatchCount >= 400) {
          await deadlineBatch.commit();
          deadlineBatchCount = 0;
        }
      }

      stats.deadlinesMigrated++;
    }

    // Commit remaining deadlines
    if (!dryRun && deadlineBatchCount > 0) {
      await deadlineBatch.commit();
    }

    // Step 4: Migrate legend entries
    const legendSnapshot = await db.collection('legend').get();
    const legendBatch = db.batch();

    for (const legendDoc of legendSnapshot.docs) {
      const legendData = legendDoc.data();
      const newLegendRef = db
        .collection('tenants')
        .doc(defaultTenantId)
        .collection('legend')
        .doc(legendDoc.id);

      if (!dryRun) {
        legendBatch.set(newLegendRef, legendData);
      }

      stats.legendMigrated++;
    }

    if (!dryRun && stats.legendMigrated > 0) {
      await legendBatch.commit();
    }

    // Step 5: Update all authenticated users' tokens
    if (!dryRun) {
      // Note: Users will need to refresh their tokens on next login
      stats.usersUpdated = stats.usersMigrated;
    }

    console.log('Migration completed:', stats);

    return {
      success: true,
      dryRun,
      stats,
      message: dryRun
        ? 'Dry run completed. Review stats before running actual migration.'
        : 'Migration completed successfully. Users need to refresh their sessions.'
    };

  } catch (error) {
    console.error('Migration failed:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Migration failed: ${error}`
    );
  }
};