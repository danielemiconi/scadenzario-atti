import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { type LegendEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const LegendPage: React.FC = () => {
  const { user } = useAuth();
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LegendEntry | null>(null);
  const [formData, setFormData] = useState({
    initials: '',
    fullName: '',
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'legend'), orderBy('initials', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: LegendEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as LegendEntry);
      });
      setLegendEntries(entries);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredEntries = legendEntries.filter(
    (entry) =>
      entry.initials.toLowerCase().includes(searchText.toLowerCase()) ||
      entry.fullName.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleEdit = (entry: LegendEntry) => {
    if (!isAdmin) return;
    setEditingEntry(entry);
    setFormData({
      initials: entry.initials,
      fullName: entry.fullName,
    });
    setShowForm(true);
  };

  const handleDelete = async (entryId: string) => {
    if (!isAdmin) return;
    if (!confirm('Sei sicuro di voler eliminare questa voce dalla legenda?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'legend', entryId));
    } catch (error) {
      console.error('Error deleting legend entry:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingEntry) {
        await updateDoc(doc(db, 'legend', editingEntry.id!), {
          initials: formData.initials.toUpperCase(),
          fullName: formData.fullName,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'legend'), {
          initials: formData.initials.toUpperCase(),
          fullName: formData.fullName,
          active: true,
          createdBy: user?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      setShowForm(false);
      setEditingEntry(null);
      setFormData({ initials: '', fullName: '' });
    } catch (error) {
      console.error('Error saving legend entry:', error);
      alert('Errore durante il salvataggio');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Gestione Legenda
            </h3>
            {isAdmin && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                + Aggiungi
              </button>
            )}
          </div>
          <div className="mt-4">
            <input
              type="text"
              placeholder="Cerca per iniziali o nome..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
        </div>

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
                    Iniziali
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome Completo
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.initials}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.fullName}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id!)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Elimina
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredEntries.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Nessuna voce trovata nella legenda
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingEntry ? 'Modifica Voce' : 'Nuova Voce Legenda'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="initials" className="block text-sm font-medium text-gray-700">
                  Iniziali (2 caratteri)
                </label>
                <input
                  type="text"
                  id="initials"
                  value={formData.initials}
                  onChange={(e) => setFormData({ ...formData, initials: e.target.value })}
                  maxLength={2}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm uppercase"
                />
              </div>

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  Nome Completo
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEntry(null);
                    setFormData({ initials: '', fullName: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};