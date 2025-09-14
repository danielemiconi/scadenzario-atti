import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase/config';
import { useTenant } from '../../contexts/TenantContext';
import { type TenantUserRole } from '../../types';

interface PendingUser {
  uid: string;
  email: string;
  name: string;
  createdAt: Date;
}

export const PendingUsers: React.FC = () => {
  const { currentTenant, userRole } = useTenant();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    loadPendingUsers();
  }, [currentTenant]);

  const loadPendingUsers = async () => {
    if (!currentTenant || userRole !== 'admin') return;

    try {
      // Get all users from /users collection
      const usersSnapshot = await getDocs(collection(db, 'users'));

      // Get all users already in the tenant
      const tenantUsersSnapshot = await getDocs(
        collection(db, 'tenants', currentTenant, 'users')
      );

      const tenantUserIds = new Set(tenantUsersSnapshot.docs.map(doc => doc.id));

      // Filter to find users not in tenant
      const pending: PendingUser[] = [];

      for (const userDoc of usersSnapshot.docs) {
        if (!tenantUserIds.has(userDoc.id)) {
          const userData = userDoc.data();
          // Skip the super admin email as they have special access
          if (userData.email !== 'daniele.miconi@iblegal.it') {
            pending.push({
              uid: userDoc.id,
              email: userData.email,
              name: userData.name || 'Nome non specificato',
              createdAt: userData.createdAt?.toDate() || new Date()
            });
          }
        }
      }

      setPendingUsers(pending);
    } catch (error) {
      console.error('Error loading pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  const inviteUser = async (user: PendingUser, role: TenantUserRole) => {
    if (!currentTenant) return;

    setInviting(user.uid);

    try {
      const updateTenantMembership = httpsCallable(functions, 'updateTenantMembership');

      await updateTenantMembership({
        userId: user.uid,
        tenantId: currentTenant,
        action: 'add',
        role
      });

      // Remove from pending list
      setPendingUsers(prev => prev.filter(u => u.uid !== user.uid));

      // Show success message (could use a toast library)
      alert(`Utente ${user.email} aggiunto con successo come ${role}`);
    } catch (error) {
      console.error('Error inviting user:', error);
      alert('Errore durante l\'aggiunta dell\'utente');
    } finally {
      setInviting(null);
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
        Utenti in Attesa di Autorizzazione
      </h3>

      {pendingUsers.length === 0 ? (
        <p className="text-gray-500">Nessun utente in attesa di autorizzazione</p>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map(user => (
            <div
              key={user.uid}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
                <p className="text-xs text-gray-400">
                  Registrato: {user.createdAt.toLocaleDateString('it-IT')}
                </p>
              </div>

              {inviting === user.uid ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => inviteUser(user, 'viewer')}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Aggiungi come Viewer
                  </button>
                  <button
                    onClick={() => inviteUser(user, 'editor')}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Aggiungi come Editor
                  </button>
                  <button
                    onClick={() => inviteUser(user, 'admin')}
                    className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                  >
                    Aggiungi come Admin
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          Come funziona l'autorizzazione:
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Viewer:</strong> Può solo visualizzare le scadenze</li>
          <li>• <strong>Editor:</strong> Può creare e modificare le scadenze</li>
          <li>• <strong>Admin:</strong> Accesso completo inclusa gestione utenti</li>
        </ul>
      </div>
    </div>
  );
};