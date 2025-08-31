import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { type Deadline, type DeadlineFilter } from '../types';
import { DeadlineList } from '../components/deadlines/DeadlineList';
import { DeadlineFilters } from '../components/deadlines/DeadlineFilters';
import { DeadlineForm } from '../components/deadlines/DeadlineForm';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
export const Dashboard: React.FC = () => {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DeadlineFilter>({});
  const [showForm, setShowForm] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [cloningDeadline, setCloningDeadline] = useState<Deadline | null>(null);

  useEffect(() => {
    setLoading(true);
    
    let q = query(
      collection(db, 'deadlines'),
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
    
    if (filters.forum) {
      q = query(q, where('forum', '==', filters.forum));
    }
    
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deadlineData: Deadline[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Deadline;
        // Set default values for fields that might not exist in older documents
        deadlineData.push({ 
          id: doc.id, 
          ...data,
          deleted: data.deleted ?? false,
          archived: data.archived ?? false
        });
      });
      
      // Filter out deleted items and apply archived filter
      let filteredData = deadlineData.filter(d => 
        d.deleted !== true && 
        d.archived === (filters.archived || false)
      );
      
      // Apply text search filter if present
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        filteredData = filteredData.filter(
          (d) =>
            d.rg.toLowerCase().includes(searchLower) ||
            d.matter.toLowerCase().includes(searchLower) ||
            d.court.toLowerCase().includes(searchLower) ||
            d.forum?.toLowerCase().includes(searchLower) ||
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
    setCloningDeadline(null);
    setShowForm(true);
  };

  const handleClone = (deadline: Deadline) => {
    // Prepara i dati per la clonazione
    const clonedDeadline: Deadline = {
      ...deadline,
      // Resetta i campi specifici come richiesto
      statusDate: undefined,
      archived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      deleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      // Rimuove l'ID per creare una nuova deadline
      id: undefined
    };
    
    setCloningDeadline(clonedDeadline);
    setEditingDeadline(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingDeadline(null);
    setCloningDeadline(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const getAppliedFilters = () => {
    const appliedFilters: string[] = [];
    if (filters.monthYear) appliedFilters.push(`Mese: ${filters.monthYear}`);
    if (filters.ownerInitials) appliedFilters.push(`Iniziali: ${filters.ownerInitials}`);
    if (filters.court) appliedFilters.push(`Ufficio: ${filters.court}`);
    if (filters.forum) appliedFilters.push(`Foro: ${filters.forum}`);
    if (filters.status) appliedFilters.push(`Stato: ${filters.status}`);
    if (filters.searchText) appliedFilters.push(`Ricerca: "${filters.searchText}"`);
    if (filters.archived) appliedFilters.push('Solo archiviati');
    return appliedFilters;
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
      {/* Header per la stampa */}
      <div className="print-only print-header">
        <h1>Scadenzario Atti Processuali</h1>
        <p>Stampato il {format(new Date(), 'dd MMMM yyyy', { locale: it })} alle {format(new Date(), 'HH:mm')}</p>
        {getAppliedFilters().length > 0 && (
          <p><strong>Filtri applicati:</strong> {getAppliedFilters().join(' • ')}</p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 no-print">
        <DeadlineFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-end items-center space-x-3 no-print">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Stampa
          </button>
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
                  <div key={monthYear} className="px-4 py-5 sm:px-6 month-section">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 month-title">
                      {monthName} {year}
                    </h4>
                    <DeadlineList
                      deadlines={groupedDeadlines[monthYear]}
                      onEdit={handleEdit}
                      onClone={handleClone}
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
          deadline={editingDeadline || cloningDeadline}
          isCloning={!!cloningDeadline}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};