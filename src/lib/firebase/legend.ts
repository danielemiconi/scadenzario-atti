import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import { type LegendEntry } from '../../types';

// Get all legend entries for a tenant
export const getLegendEntries = async (
  tenantId: string,
  activeOnly = false
): Promise<LegendEntry[]> => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  let q;
  if (activeOnly) {
    q = query(
      collection(db, 'tenants', tenantId, 'legend'),
      where('active', '==', true),
      orderBy('initials', 'asc')
    );
  } else {
    q = query(
      collection(db, 'tenants', tenantId, 'legend'),
      orderBy('initials', 'asc')
    );
  }

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as LegendEntry));
};

// Create a new legend entry
export const createLegendEntry = async (
  tenantId: string,
  entry: Omit<LegendEntry, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Check for duplicate initials
  const existingQuery = query(
    collection(db, 'tenants', tenantId, 'legend'),
    where('initials', '==', entry.initials)
  );
  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) {
    throw new Error(`Le iniziali "${entry.initials}" sono già in uso`);
  }

  const newEntry = {
    ...entry,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(
    collection(db, 'tenants', tenantId, 'legend'),
    newEntry
  );

  return docRef.id;
};

// Update a legend entry
export const updateLegendEntry = async (
  tenantId: string,
  entryId: string,
  updates: Partial<LegendEntry>
): Promise<void> => {
  if (!tenantId || !entryId) {
    throw new Error('Tenant ID and Entry ID are required');
  }

  // If updating initials, check for duplicates
  if (updates.initials) {
    const existingQuery = query(
      collection(db, 'tenants', tenantId, 'legend'),
      where('initials', '==', updates.initials)
    );
    const existingSnapshot = await getDocs(existingQuery);

    // Check if any found document is not the current one
    const isDuplicate = existingSnapshot.docs.some(doc => doc.id !== entryId);

    if (isDuplicate) {
      throw new Error(`Le iniziali "${updates.initials}" sono già in uso`);
    }
  }

  const entryRef = doc(db, 'tenants', tenantId, 'legend', entryId);

  await updateDoc(entryRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

// Delete a legend entry
export const deleteLegendEntry = async (
  tenantId: string,
  entryId: string
): Promise<void> => {
  if (!tenantId || !entryId) {
    throw new Error('Tenant ID and Entry ID are required');
  }

  // Check if the legend entry is used in any deadlines
  const deadlinesQuery = query(
    collection(db, 'tenants', tenantId, 'deadlines'),
    where('ownerInitials', '==', entryId),
    where('deleted', '==', false)
  );
  const deadlinesSnapshot = await getDocs(deadlinesQuery);

  if (!deadlinesSnapshot.empty) {
    throw new Error(
      'Impossibile eliminare questa voce della legenda perché è utilizzata in una o più scadenze'
    );
  }

  const entryRef = doc(db, 'tenants', tenantId, 'legend', entryId);
  await deleteDoc(entryRef);
};

// Toggle active status of a legend entry
export const toggleLegendEntryActive = async (
  tenantId: string,
  entryId: string,
  active: boolean
): Promise<void> => {
  if (!tenantId || !entryId) {
    throw new Error('Tenant ID and Entry ID are required');
  }

  const entryRef = doc(db, 'tenants', tenantId, 'legend', entryId);

  await updateDoc(entryRef, {
    active,
    updatedAt: serverTimestamp()
  });
};

// Get legend entry by initials
export const getLegendEntryByInitials = async (
  tenantId: string,
  initials: string
): Promise<LegendEntry | null> => {
  if (!tenantId || !initials) {
    throw new Error('Tenant ID and initials are required');
  }

  const q = query(
    collection(db, 'tenants', tenantId, 'legend'),
    where('initials', '==', initials)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  } as LegendEntry;
};