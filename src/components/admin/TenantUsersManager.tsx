import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase/config';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { type TenantUser, type TenantUserRole } from '../../types';

interface TenantUserWithDetails extends TenantUser {
  email?: string;
  name?: string;
}

export const TenantUsersManager: React.FC = () => {
  const { currentTenant, userRole } = useTenant();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<TenantUserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (currentTenant) {
      loadTenantUsers();
    }
  }, [currentTenant]);

  const loadTenantUsers = async () => {
    if (!currentTenant || userRole !== 'admin') return;

    try {
      setLoading(true);

      // Get tenant users
      const tenantUsersSnapshot = await getDocs(
        collection(db, 'tenants', currentTenant, 'users')
      );

      const tenantUsers: TenantUserWithDetails[] = [];

      for (const tenantUserDoc of tenantUsersSnapshot.docs) {
        const tenantUserData = tenantUserDoc.data() as TenantUser;

        // Get user details from users collection
        const userDoc = await getDocs(
          collection(db, 'users')
        );

        const userDetails = userDoc.docs.find(doc => doc.id === tenantUserData.uid);

        if (userDetails) {
          const userData = userDetails.data();
          tenantUsers.push({
            ...tenantUserData,
            email: userData.email,
            name: userData.name || 'Nome non specificato'
          });
        }
      }

      setUsers(tenantUsers);
    } catch (error) {
      console.error('Error loading tenant users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: TenantUserRole) => {
    if (!currentTenant) return;

    setActionLoading(userId);

    try {
      await updateDoc(
        doc(db, 'tenants', currentTenant, 'users', userId),
        { role: newRole }
      );

      // Update local state
      setUsers(prev => prev.map(u =>
        u.uid === userId ? { ...u, role: newRole } : u
      ));

      alert(`Ruolo aggiornato con successo`);
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Errore durante l\'aggiornamento del ruolo');
    } finally {
      setActionLoading(null);
    }
  };

  const updateUserStatus = async (userId: string, status: 'active' | 'suspended') => {
    if (!currentTenant) return;

    setActionLoading(userId);

    try {
      await updateDoc(
        doc(db, 'tenants', currentTenant, 'users', userId),
        { status }
      );

      // Update local state
      setUsers(prev => prev.map(u =>
        u.uid === userId ? { ...u, status } : u
      ));

      alert(`Utente ${status === 'suspended' ? 'sospeso' : 'riattivato'} con successo`);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Errore durante l\'aggiornamento dello stato');
    } finally {
      setActionLoading(null);
    }
  };

  const removeUserFromTenant = async (userId: string) => {
    if (!currentTenant) return;

    const user = users.find(u => u.uid === userId);
    if (!user) return;

    const confirmMessage = `Sei sicuro di voler rimuovere ${user.name || user.email} dal tenant?\n\nL'utente perderà l'accesso a tutti i dati del tenant.`;

    if (!confirm(confirmMessage)) return;

    setActionLoading(userId);

    try {
      // Use the Cloud Function to remove user from tenant
      const updateTenantMembership = httpsCallable(functions, 'updateTenantMembership');

      await updateTenantMembership({
        userId,
        tenantId: currentTenant,
        action: 'remove'
      });

      // Remove from local state
      setUsers(prev => prev.filter(u => u.uid !== userId));

      alert('Utente rimosso dal tenant con successo');
    } catch (error) {
      console.error('Error removing user from tenant:', error);
      alert('Errore durante la rimozione dell\'utente');
    } finally {
      setActionLoading(null);
    }
  };

  if (userRole !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Utenti del Tenant
      </h3>

      {users.length === 0 ? (
        <p className="text-gray-500">Nessun utente nel tenant</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ruolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membro dal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.uid} className={user.status === 'suspended' ? 'bg-red-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.uid, e.target.value as TenantUserRole)}
                      disabled={actionLoading === user.uid || user.uid === currentUser?.uid}
                      className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : user.status === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.status === 'active' ? 'Attivo' :
                       user.status === 'suspended' ? 'Sospeso' : 'Invitato'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.joinedAt && (user.joinedAt as any).toDate
                      ? (user.joinedAt as any).toDate().toLocaleDateString('it-IT')
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {actionLoading === user.uid ? (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    ) : (
                      <div className="flex justify-end space-x-2">
                        {user.uid !== currentUser?.uid && (
                          <>
                            {user.status === 'active' ? (
                              <button
                                onClick={() => updateUserStatus(user.uid, 'suspended')}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Sospendi utente"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => updateUserStatus(user.uid, 'active')}
                                className="text-green-600 hover:text-green-900"
                                title="Riattiva utente"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}

                            <button
                              onClick={() => removeUserFromTenant(user.uid)}
                              className="text-red-600 hover:text-red-900"
                              title="Rimuovi dal tenant"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-amber-50 rounded-lg">
        <h4 className="text-sm font-medium text-amber-900 mb-2">
          Gestione Utenti:
        </h4>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• <strong>Cambia Ruolo:</strong> Usa il dropdown per modificare il ruolo dell'utente</li>
          <li>• <strong>Sospendi:</strong> L'utente non potrà più accedere ma mantiene i suoi dati</li>
          <li>• <strong>Rimuovi:</strong> L'utente perde completamente l'accesso al tenant</li>
          <li>• Non puoi modificare o rimuovere il tuo stesso account</li>
        </ul>
      </div>
    </div>
  );
};