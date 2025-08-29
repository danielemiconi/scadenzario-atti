import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, functions } from '../lib/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { User } from '../types';

export const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Errore durante l\'aggiornamento del ruolo');
    }
  };

  const exportData = async () => {
    try {
      const exportDataFn = httpsCallable(functions, 'exportData');
      const result = await exportDataFn({ format: 'csv' });
      
      // Create blob and download
      const blob = new Blob([result.data as string], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scadenzario_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Errore durante l\'esportazione dei dati');
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

        <div className="px-4 py-5 sm:px-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Gestione Utenti</h4>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
                          className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
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

        <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Azioni di Sistema</h4>
          
          <div className="space-y-3">
            <button
              onClick={exportData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Esporta Dati CSV
            </button>
            
            <div className="text-sm text-gray-600">
              <p>• Export CSV: Esporta tutti gli atti in formato CSV</p>
              <p>• I ruoli utente richiedono il logout/login per essere applicati</p>
              <p>• Le modifiche ai ruoli sono registrate nel log di audit</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};