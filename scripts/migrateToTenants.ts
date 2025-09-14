#!/usr/bin/env node

/**
 * Migration script to convert single-tenant data to multi-tenant structure
 * Run with: npx ts-node scripts/migrateToTenants.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Load service account key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
                          path.join(__dirname, '../firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found. Please set FIREBASE_SERVICE_ACCOUNT environment variable or place firebase-service-account.json in project root.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const DEFAULT_TENANT_ID = 'default';
const DEFAULT_TENANT_NAME = 'Studio Legale';

interface MigrationStats {
  tenantCreated: boolean;
  usersUpdated: number;
  usersMigrated: number;
  deadlinesMigrated: number;
  legendMigrated: number;
  auditLogsMigrated: number;
  notificationsMigrated: number;
  errors: string[];
  warnings: string[];
}

async function migrateToMultiTenant(dryRun = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    tenantCreated: false,
    usersUpdated: 0,
    usersMigrated: 0,
    deadlinesMigrated: 0,
    legendMigrated: 0,
    auditLogsMigrated: 0,
    notificationsMigrated: 0,
    errors: [],
    warnings: []
  };

  console.log(`Starting migration to multi-tenant structure (dryRun: ${dryRun})`);
  console.log('=====================================');

  try {
    // Step 1: Create default tenant
    console.log('\n1. Creating default tenant...');
    const tenantRef = db.collection('tenants').doc(DEFAULT_TENANT_ID);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      const tenantData = {
        name: DEFAULT_TENANT_NAME,
        plan: 'pro',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'migration-script'
      };

      if (!dryRun) {
        await tenantRef.set(tenantData);
      }
      stats.tenantCreated = true;
      console.log(`✓ Default tenant "${DEFAULT_TENANT_NAME}" created`);
    } else {
      console.log('✓ Default tenant already exists');
    }

    // Step 2: Migrate users
    console.log('\n2. Migrating users...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users`);

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
            const currentUser = await auth.getUser(uid);
            const currentClaims = currentUser.customClaims || {};

            await auth.setCustomUserClaims(uid, {
              ...currentClaims,
              tenants: [DEFAULT_TENANT_ID]
            });
            stats.usersUpdated++;
          } catch (authError: any) {
            stats.warnings.push(`Could not update claims for user ${uid}: ${authError.message}`);
          }

          // Update user profile with default tenant
          await userDoc.ref.update({
            defaultTenant: DEFAULT_TENANT_ID,
            lastSelectedTenant: DEFAULT_TENANT_ID
          });
        }

        stats.usersMigrated++;
        console.log(`  ✓ User ${userData.email} (${uid}) migrated as ${tenantRole}`);
      } catch (error: any) {
        stats.errors.push(`Failed to migrate user ${uid}: ${error.message}`);
        console.error(`  ✗ Failed to migrate user ${uid}:`, error.message);
      }
    }

    // Step 3: Migrate deadlines
    console.log('\n3. Migrating deadlines...');
    const deadlinesSnapshot = await db.collection('deadlines').get();
    console.log(`Found ${deadlinesSnapshot.size} deadlines`);

    const deadlineBatch = db.batch();
    let deadlineBatchCount = 0;

    for (const deadlineDoc of deadlinesSnapshot.docs) {
      const deadlineData = deadlineDoc.data();
      const newDeadlineRef = db
        .collection('tenants')
        .doc(DEFAULT_TENANT_ID)
        .collection('deadlines')
        .doc(deadlineDoc.id);

      if (!dryRun) {
        deadlineBatch.set(newDeadlineRef, deadlineData);
        deadlineBatchCount++;

        // Commit batch every 400 documents (Firestore limit is 500)
        if (deadlineBatchCount >= 400) {
          await deadlineBatch.commit();
          deadlineBatchCount = 0;
          console.log(`  ✓ Committed batch of ${deadlineBatchCount} deadlines`);
        }
      }

      stats.deadlinesMigrated++;
    }

    // Commit remaining deadlines
    if (!dryRun && deadlineBatchCount > 0) {
      await deadlineBatch.commit();
      console.log(`  ✓ Committed final batch of ${deadlineBatchCount} deadlines`);
    }
    console.log(`✓ Total deadlines migrated: ${stats.deadlinesMigrated}`);

    // Step 4: Migrate legend entries
    console.log('\n4. Migrating legend entries...');
    const legendSnapshot = await db.collection('legend').get();
    console.log(`Found ${legendSnapshot.size} legend entries`);

    const legendBatch = db.batch();

    for (const legendDoc of legendSnapshot.docs) {
      const legendData = legendDoc.data();
      const newLegendRef = db
        .collection('tenants')
        .doc(DEFAULT_TENANT_ID)
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
    console.log(`✓ Legend entries migrated: ${stats.legendMigrated}`);

    // Step 5: Migrate audit logs (optional)
    console.log('\n5. Migrating audit logs...');
    const auditLogsSnapshot = await db.collection('auditLogs').get();
    console.log(`Found ${auditLogsSnapshot.size} audit logs`);

    if (auditLogsSnapshot.size > 0) {
      const auditBatch = db.batch();
      let auditBatchCount = 0;

      for (const auditDoc of auditLogsSnapshot.docs) {
        const auditData = auditDoc.data();
        const newAuditRef = db
          .collection('tenants')
          .doc(DEFAULT_TENANT_ID)
          .collection('auditLogs')
          .doc(auditDoc.id);

        if (!dryRun) {
          auditBatch.set(newAuditRef, auditData);
          auditBatchCount++;

          if (auditBatchCount >= 400) {
            await auditBatch.commit();
            auditBatchCount = 0;
          }
        }

        stats.auditLogsMigrated++;
      }

      if (!dryRun && auditBatchCount > 0) {
        await auditBatch.commit();
      }
    }
    console.log(`✓ Audit logs migrated: ${stats.auditLogsMigrated}`);

    // Step 6: Migrate notifications (optional)
    console.log('\n6. Migrating notifications...');
    const notificationsSnapshot = await db.collection('notifications').get();
    console.log(`Found ${notificationsSnapshot.size} notifications`);

    if (notificationsSnapshot.size > 0) {
      const notificationBatch = db.batch();

      for (const notificationDoc of notificationsSnapshot.docs) {
        const notificationData = notificationDoc.data();
        const newNotificationRef = db
          .collection('tenants')
          .doc(DEFAULT_TENANT_ID)
          .collection('notifications')
          .doc(notificationDoc.id);

        if (!dryRun) {
          notificationBatch.set(newNotificationRef, notificationData);
        }

        stats.notificationsMigrated++;
      }

      if (!dryRun && stats.notificationsMigrated > 0) {
        await notificationBatch.commit();
      }
    }
    console.log(`✓ Notifications migrated: ${stats.notificationsMigrated}`);

    // Print summary
    console.log('\n=====================================');
    console.log('Migration Summary:');
    console.log('=====================================');
    console.log(`Tenant created: ${stats.tenantCreated ? 'Yes' : 'No (already exists)'}`);
    console.log(`Users migrated: ${stats.usersMigrated}`);
    console.log(`Users with updated claims: ${stats.usersUpdated}`);
    console.log(`Deadlines migrated: ${stats.deadlinesMigrated}`);
    console.log(`Legend entries migrated: ${stats.legendMigrated}`);
    console.log(`Audit logs migrated: ${stats.auditLogsMigrated}`);
    console.log(`Notifications migrated: ${stats.notificationsMigrated}`);

    if (stats.warnings.length > 0) {
      console.log('\nWarnings:');
      stats.warnings.forEach(warning => console.log(`  ⚠ ${warning}`));
    }

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(error => console.log(`  ✗ ${error}`));
    }

    if (dryRun) {
      console.log('\n⚠ DRY RUN MODE - No changes were made to the database');
      console.log('Run without --dry-run flag to apply changes');
    } else {
      console.log('\n✓ Migration completed successfully!');
      console.log('\nIMPORTANT: Users need to log out and log back in to refresh their tokens');
    }

    return stats;
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run migration
migrateToMultiTenant(dryRun)
  .then(() => {
    console.log('\nExiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });