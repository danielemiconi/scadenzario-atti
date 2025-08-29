import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase/config';

// Utility function for admin to run data migration
export const runDataMigration = async (): Promise<void> => {
  try {
    console.log('Starting data migration...');
    const migrationFunction = httpsCallable(functions, 'runMigration');
    const result = await migrationFunction({});
    console.log('Migration completed:', result.data);
    alert(`Migrazione completata: ${JSON.stringify(result.data)}`);
  } catch (error) {
    console.error('Migration failed:', error);
    if (error instanceof Error) {
      alert(`Errore durante la migrazione: ${error.message}`);
    } else {
      alert('Errore durante la migrazione - dettagli nella console');
    }
  }
};

// Test function for archiving
export const testArchiveFunction = async (deadlineId: string): Promise<void> => {
  try {
    console.log('Testing archive function...');
    const archiveFunction = httpsCallable(functions, 'archiveDeadline');
    
    // Test archiving
    const archiveResult = await archiveFunction({
      deadlineId: deadlineId,
      archived: true
    });
    console.log('Archive test result:', archiveResult.data);
    
    // Test restoring
    const restoreResult = await archiveFunction({
      deadlineId: deadlineId,
      archived: false
    });
    console.log('Restore test result:', restoreResult.data);
    
    alert('Test di archiviazione completato con successo');
  } catch (error) {
    console.error('Archive test failed:', error);
    if (error instanceof Error) {
      alert(`Errore durante il test: ${error.message}`);
    } else {
      alert('Errore durante il test - dettagli nella console');
    }
  }
};