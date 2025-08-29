import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { type Deadline, type DeadlineFilter } from '../types';
import { DeadlineList } from '../components/deadlines/DeadlineList';
import { DeadlineFilters } from '../components/deadlines/DeadlineFilters';
import { DeadlineForm } from '../components/deadlines/DeadlineForm';
export const Dashboard: React.FC = () => {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DeadlineFilter>({});
  const [showForm, setShowForm] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);

  useEffect(() => {
    setLoading(true);
    
    let q = query(
      collection(db, 'deadlines'),
      where('deleted', '==', false),
      where('archived', '==', filters.archived || false),
      orderBy('hearingDate', 'asc')
    );

    if (filters.monthYear) {
      q = query(q, where('monthYear', '==', filters.monthYear));
    }
    
    if (filters.ownerInitials) {
      q = query(q, where('ownerInitials', '==', filters.ownerInitials));
    }
    
    if (filters.court) {
      q = query(q, where('court', '==', filters.court));
    }
    
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deadlineData: Deadline[] = [];
      snapshot.forEach((doc) => {
        deadlineData.push({ id: doc.id, ...doc.data() } as Deadline);
      });
      
      // Apply text search filter if present
      let filteredData = deadlineData;
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        filteredData = deadlineData.filter(
          (d) =>
            d.rg.toLowerCase().includes(searchLower) ||
            d.matter.toLowerCase().includes(searchLower) ||
            d.court.toLowerCase().includes(searchLower) ||
            d.actType.toLowerCase().includes(searchLower) ||
            d.notes?.toLowerCase().includes(searchLower)
        );
      }
      
      setDeadlines(filteredData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filters]);

  const handleEdit = (deadline: Deadline) => {
    setEditingDeadline(deadline);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingDeadline(null);
  };

  // Group deadlines by month
  const groupedDeadlines = deadlines.reduce((acc, deadline) => {
    const monthKey = deadline.monthYear;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(deadline);
    return acc;
  }, {} as Record<string, Deadline[]>);

  const monthNames: Record<string, string> = {
    '01': 'GENNAIO',
    '02': 'FEBBRAIO',
    '03': 'MARZO',
    '04': 'APRILE',
    '05': 'MAGGIO',
    '06': 'GIUGNO',
    '07': 'LUGLIO',
    '08': 'AGOSTO',
    '09': 'SETTEMBRE',
    '10': 'OTTOBRE',
    '11': 'NOVEMBRE',
    '12': 'DICEMBRE',
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6 no-print">
        <DeadlineFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center no-print">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Atti con Scadenza
          </h3>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            + Nuovo Atto
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.keys(groupedDeadlines)
              .sort()
              .map((monthYear) => {
                const [year, month] = monthYear.split('-');
                const monthName = monthNames[month] || month;
                
                return (
                  <div key={monthYear} className="px-4 py-5 sm:px-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      {monthName} {year}
                    </h4>
                    <DeadlineList
                      deadlines={groupedDeadlines[monthYear]}
                      onEdit={handleEdit}
                    />
                  </div>
                );
              })}
            
            {deadlines.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Nessun atto trovato con i filtri selezionati
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <DeadlineForm
          deadline={editingDeadline}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};