import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, functions } from '../lib/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { type User } from '../types';
import { runDataMigration } from '../utils/adminUtils';
import { ExportModal } from '../components/admin/ExportModal';
import { ImportModal } from '../components/admin/ImportModal';
import { PendingUsers } from '../components/admin/PendingUsers';
import { TenantUsersManager } from '../components/admin/TenantUsersManager';
import { InviteUserModal } from '../components/tenant/InviteUserModal';
import { useTenant } from '../contexts/TenantContext';

export const AdminPage: React.FC = () => {
  const { currentTenant } = useTenant();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'data' | 'system'>('users');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const userData: User[] = [];
      snapshot.forEach((doc) => {
        userData.push({ uid: doc.id, ...doc.data() } as User);
      });
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'standard') => {
    try {
      // Update role in Firestore
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
      });

      // Update custom claims via Cloud Function
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({ uid: userId, role: newRole });

      // Refresh user list
      await fetchUsers();
      
      alert(`Ruolo aggiornato con successo. L'utente dovrà rieffettuare il login per vedere le modifiche.`);
    } catch (error: any) {
      console.error('Error updating user role:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Errore durante l\'aggiornamento del ruolo';
      if (error?.code === 'functions/permission-denied') {
        errorMessage = 'Errore: Non hai i permessi per modificare i ruoli utente. Rieffettua il login se hai appena ottenuto i privilegi di admin.';
      } else if (error?.code === 'functions/unauthenticated') {
        errorMessage = 'Errore: Devi essere autenticato per modificare i ruoli utente.';
      } else if (error?.message) {
        errorMessage = `Errore: ${error.message}`;
      }
      
      alert(errorMessage);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return (
          <div className="px-4 py-5 sm:px-6">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-md font-medium text-gray-900">Gestione Utenti</h4>
              <button
                onClick={() => setInviteModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
              >
                Invita Nuovo Utente
              </button>
            </div>

            {/* Pending Users Section */}
            <div className="mb-8">
              <PendingUsers />
            </div>

            {/* Active Tenant Users Management */}
            <div className="mb-8">
              <TenantUsersManager />
            </div>

            <h4 className="text-md font-medium text-gray-900 mb-4">Tutti gli Utenti del Sistema (Legacy)</h4>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Iniziali
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ruolo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.initials}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.uid!, e.target.value as 'admin' | 'standard')}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="standard">Standard</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 'data':
        return (
          <div className="px-4 py-5 sm:px-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Gestione Dati</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h5 className="font-medium text-green-900 mb-2">📥 Esportazione Dati</h5>
                <p className="text-sm text-green-800 mb-3">
                  Esporta le scadenze in formato CSV con filtri avanzati
                </p>
                <button
                  onClick={() => setExportModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Esporta CSV
                </button>
              </div>

              {/* Import Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">📤 Importazione Dati</h5>
                <p className="text-sm text-blue-800 mb-3">
                  Importa scadenze da file CSV con validazione automatica
                </p>
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Importa CSV
                </button>
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Informazioni sui formati:</h5>
              <ul className="space-y-1">
                <li>• Formato CSV con delimitatore punto e virgola (;)</li>
                <li>• Colonne obbligatorie: Iniziali, Pratica, Ufficio, RG, Tipo Atto, Data Udienza</li>
                <li>• Formato date: DD/MM/YYYY</li>
                <li>• Formato RG: numero/anno (es. 506/2025)</li>
                <li>• Import con controllo duplicati automatico</li>
              </ul>
            </div>
          </div>
        );

      case 'system':
        return (
          <div className="px-4 py-5 sm:px-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Operazioni di Sistema</h4>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h5 className="font-medium text-yellow-900 mb-2">🔧 Migrazione Dati</h5>
                <p className="text-sm text-yellow-800 mb-3">
                  Aggiungi campi 'deleted' e 'archived' ai documenti esistenti che non li hanno
                </p>
                <button
                  onClick={runDataMigration}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Esegui Migrazione
                </button>
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Note importanti:</h5>
              <ul className="space-y-1">
                <li>• Le modifiche ai ruoli utente richiedono logout/login per essere applicate</li>
                <li>• Tutte le operazioni sono registrate nel log di audit</li>
                <li>• Le operazioni di sistema sono irreversibili</li>
                <li>• Effettua sempre un backup prima delle migrazioni</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Pannello di Amministrazione
          </h3>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('users')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Gestione Utenti
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'data'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Gestione Dati
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'system'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚙️ Sistema
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
      <InviteUserModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSuccess={() => {
          setInviteModalOpen(false);
          // Reload pending users will happen automatically in PendingUsers component
        }}
      />
    </div>
  );
};