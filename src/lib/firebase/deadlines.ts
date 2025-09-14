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
  serverTimestamp,
  Timestamp,
  type QueryConstraint
} from 'firebase/firestore';
import { db } from './config';
import { type Deadline, type DeadlineFilter } from '../../types';

// Get deadlines with filters for a specific tenant
export const getDeadlines = async (
  tenantId: string,
  filters?: DeadlineFilter
): Promise<Deadline[]> => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const constraints: QueryConstraint[] = [];

  // Apply filters
  if (filters?.monthYear) {
    constraints.push(where('monthYear', '==', filters.monthYear));
  }
  if (filters?.ownerInitials) {
    constraints.push(where('ownerInitials', '==', filters.ownerInitials));
  }
  if (filters?.court) {
    constraints.push(where('court', '==', filters.court));
  }
  if (filters?.forum) {
    constraints.push(where('forum', '==', filters.forum));
  }
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  // Handle archived/deleted filters
  if (filters?.archived !== undefined) {
    constraints.push(where('archived', '==', filters.archived));
  } else {
    // Default: exclude archived
    constraints.push(where('archived', '==', false));
  }

  // Always exclude soft-deleted items unless explicitly requested
  constraints.push(where('deleted', '==', false));

  // Default ordering
  constraints.push(orderBy('hearingDate', 'asc'));

  const q = query(
    collection(db, 'tenants', tenantId, 'deadlines'),
    ...constraints
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Deadline));
};

// Create a new deadline for a tenant
export const createDeadline = async (
  tenantId: string,
  deadline: Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const newDeadline = {
    ...deadline,
    archived: false,
    deleted: false,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(
    collection(db, 'tenants', tenantId, 'deadlines'),
    newDeadline
  );

  return docRef.id;
};

// Update an existing deadline
export const updateDeadline = async (
  tenantId: string,
  deadlineId: string,
  updates: Partial<Deadline>,
  userId: string
): Promise<void> => {
  if (!tenantId || !deadlineId) {
    throw new Error('Tenant ID and Deadline ID are required');
  }

  const deadlineRef = doc(db, 'tenants', tenantId, 'deadlines', deadlineId);

  await updateDoc(deadlineRef, {
    ...updates,
    updatedBy: userId,
    updatedAt: serverTimestamp()
  });
};

// Archive a deadline
export const archiveDeadline = async (
  tenantId: string,
  deadlineId: string,
  userId: string
): Promise<void> => {
  if (!tenantId || !deadlineId) {
    throw new Error('Tenant ID and Deadline ID are required');
  }

  const deadlineRef = doc(db, 'tenants', tenantId, 'deadlines', deadlineId);

  await updateDoc(deadlineRef, {
    archived: true,
    archivedAt: serverTimestamp(),
    archivedBy: userId,
    updatedAt: serverTimestamp()
  });
};

// Restore an archived deadline
export const restoreDeadline = async (
  tenantId: string,
  deadlineId: string,
  userId: string
): Promise<void> => {
  if (!tenantId || !deadlineId) {
    throw new Error('Tenant ID and Deadline ID are required');
  }

  const deadlineRef = doc(db, 'tenants', tenantId, 'deadlines', deadlineId);

  await updateDoc(deadlineRef, {
    archived: false,
    archivedAt: null,
    archivedBy: null,
    updatedBy: userId,
    updatedAt: serverTimestamp()
  });
};

// Soft delete a deadline
export const softDeleteDeadline = async (
  tenantId: string,
  deadlineId: string,
  userId: string
): Promise<void> => {
  if (!tenantId || !deadlineId) {
    throw new Error('Tenant ID and Deadline ID are required');
  }

  const deadlineRef = doc(db, 'tenants', tenantId, 'deadlines', deadlineId);

  await updateDoc(deadlineRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: userId,
    updatedAt: serverTimestamp()
  });
};

// Permanently delete a deadline (admin only)
export const permanentlyDeleteDeadline = async (
  tenantId: string,
  deadlineId: string
): Promise<void> => {
  if (!tenantId || !deadlineId) {
    throw new Error('Tenant ID and Deadline ID are required');
  }

  const deadlineRef = doc(db, 'tenants', tenantId, 'deadlines', deadlineId);
  await deleteDoc(deadlineRef);
};

// Get trashed deadlines
export const getTrashedDeadlines = async (
  tenantId: string
): Promise<Deadline[]> => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const q = query(
    collection(db, 'tenants', tenantId, 'deadlines'),
    where('deleted', '==', true),
    orderBy('deletedAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Deadline));
};

// Restore from trash
export const restoreFromTrash = async (
  tenantId: string,
  deadlineId: string,
  userId: string
): Promise<void> => {
  if (!tenantId || !deadlineId) {
    throw new Error('Tenant ID and Deadline ID are required');
  }

  const deadlineRef = doc(db, 'tenants', tenantId, 'deadlines', deadlineId);

  await updateDoc(deadlineRef, {
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    updatedBy: userId,
    updatedAt: serverTimestamp()
  });
};

// Empty trash (permanently delete all trashed items)
export const emptyTrash = async (
  tenantId: string
): Promise<number> => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const q = query(
    collection(db, 'tenants', tenantId, 'deadlines'),
    where('deleted', '==', true)
  );

  const snapshot = await getDocs(q);

  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);

  return snapshot.size;
};