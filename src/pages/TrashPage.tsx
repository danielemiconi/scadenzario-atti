import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase/config';
import { type Deadline } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const TrashPage: React.FC = () => {
  const [deletedDeadlines, setDeletedDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, 'restoring' | 'deleting' | null>>({});
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.email !== 'daniele.miconi@iblegal.it')) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const q = query(
      collection(db, 'deadlines'),
      where('deleted', '==', true),
      orderBy('deletedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deletedData: Deadline[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Deadline;
        deletedData.push({ id: doc.id, ...data });
      });
      
      setDeletedDeadlines(deletedData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRestore = async (deadlineId: string) => {
    if (!confirm('Sei sicuro di voler ripristinare questo atto?')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [deadlineId]: 'restoring' }));

    try {
      const restoreFunction = httpsCallable(functions, 'restoreDeadline');
      await restoreFunction({ deadlineId });
      alert('Atto ripristinato con successo');
    } catch (error) {
      console.error('Error restoring deadline:', error);
      if (error instanceof Error) {
        alert(`Errore durante il ripristino: ${error.message}`);
      } else {
        alert('Errore durante il ripristino - dettagli nella console');
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [deadlineId]: null }));
    }
  };

  const handlePermanentDelete = async (deadlineId: string) => {
    if (!confirm('ATTENZIONE: Sei sicuro di voler eliminare DEFINITIVAMENTE questo atto? Questa azione NON è reversibile!')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [deadlineId]: 'deleting' }));

    try {
      const permanentDeleteFunction = httpsCallable(functions, 'permanentlyDelete');
      await permanentDeleteFunction({ deadlineId });
      alert('Atto eliminato definitivamente');
    } catch (error) {
      console.error('Error permanently deleting deadline:', error);
      if (error instanceof Error) {
        alert(`Errore durante l'eliminazione definitiva: ${error.message}`);
      } else {
        alert('Errore durante l\'eliminazione definitiva - dettagli nella console');
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [deadlineId]: null }));
    }
  };

  const handleEmptyTrash = async () => {
    if (deletedDeadlines.length === 0) {
      alert('Il cestino è già vuoto');
      return;
    }

    if (!confirm(`ATTENZIONE: Stai per eliminare DEFINITIVAMENTE ${deletedDeadlines.length} atti dal cestino. Questa azione NON è reversibile! Sei sicuro di voler procedere?`)) {
      return;
    }

    setEmptyingTrash(true);

    try {
      const emptyTrashFunction = httpsCallable(functions, 'emptyTrash');
      const result = await emptyTrashFunction({ confirm: true });
      alert((result.data as any).message);
    } catch (error) {
      console.error('Error emptying trash:', error);
      if (error instanceof Error) {
        alert(`Errore durante lo svuotamento del cestino: ${error.message}`);
      } else {
        alert('Errore durante lo svuotamento del cestino - dettagli nella console');
      }
    } finally {
      setEmptyingTrash(false);
    }
  };

  if (!user || (user.role !== 'admin' && user.email !== 'daniele.miconi@iblegal.it')) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h2>
          <p className="text-gray-600">Solo gli amministratori possono accedere al cestino.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <svg className="w-8 h-8 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Cestino
            </h1>
            <p className="text-gray-600 mt-1">
              {deletedDeadlines.length} {deletedDeadlines.length === 1 ? 'atto eliminato' : 'atti eliminati'}
            </p>
          </div>
          
          {deletedDeadlines.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              disabled={emptyingTrash}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {emptyingTrash ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Svuotando...
                </>
              ) : (
                'Svuota Cestino'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : deletedDeadlines.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Cestino vuoto</h3>
            <p>Non ci sono atti eliminati da visualizzare.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Atto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eliminato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deletedDeadlines.map((deadline) => (
                  <tr key={deadline.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {deadline.matter}
                      </div>
                      <div className="text-sm text-gray-500">
                        RG: {deadline.rg} • {deadline.court} • {deadline.actType}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {deadline.deletedAt && format(deadline.deletedAt.toDate(), 'PPpp', { locale: it })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRestore(deadline.id!)}
                          disabled={actionLoading[deadline.id!] === 'restoring'}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          {actionLoading[deadline.id!] === 'restoring' ? 'Ripristinando...' : 'Ripristina'}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(deadline.id!)}
                          disabled={actionLoading[deadline.id!] === 'deleting'}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {actionLoading[deadline.id!] === 'deleting' ? 'Eliminando...' : 'Elimina Definitivamente'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};