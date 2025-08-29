import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const addMissingFields = async () => {
  console.log('Starting migration: adding missing deleted and archived fields...');
  
  try {
    const deadlinesRef = admin.firestore().collection('deadlines');
    const snapshot = await deadlinesRef.get();
    
    console.log(`Found ${snapshot.size} deadline documents to potentially update`);
    
    const batch = admin.firestore().batch();
    let updateCount = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      let needsUpdate = false;
      const updates: any = {};
      
      // Add deleted field if missing
      if (data.deleted === undefined) {
        updates.deleted = false;
        needsUpdate = true;
      }
      
      // Add archived field if missing
      if (data.archived === undefined) {
        updates.archived = false;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        updateCount++;
        console.log(`Scheduled update for document ${doc.id}`);
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updateCount} documents with missing fields`);
    } else {
      console.log('No documents needed updates');
    }
    
    return {
      success: true,
      message: `Migration completed: ${updateCount} documents updated`,
      updatedCount: updateCount,
      totalCount: snapshot.size
    };
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
};

// HTTP function to trigger the migration (admin only)
export const runMigration = async (
  data: any, 
  context: functions.https.CallableContext
) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to run migrations.'
    );
  }

  // Get user data to check role
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(context.auth.uid)
    .get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'User profile not found.'
    );
  }

  const userData = userDoc.data();
  const isAdmin = userData?.role === 'admin';

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only administrators can run migrations.'
    );
  }

  try {
    return await addMissingFields();
  } catch (error) {
    console.error('Migration failed:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Migration failed - see logs for details.'
    );
  }
};