import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { type DeadlineStatus, DeadlineStatus as DeadlineStatusEnum } from '../../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportFilters {
  format: 'csv';
  monthYear: string;
  status: DeadlineStatus | '';
  ownerInitials: string;
  court: string;
  startDate: string;
  endDate: string;
  includeArchived: boolean;
  includeColumns: string[];
}

const allColumns = [
  { key: 'ownerInitials', label: 'Iniziali', default: true },
  { key: 'matter', label: 'Pratica', default: true },
  { key: 'court', label: 'Ufficio', default: true },
  { key: 'forum', label: 'Foro', default: false },
  { key: 'rg', label: 'RG', default: true },
  { key: 'actType', label: 'Tipo Atto', default: true },
  { key: 'hearingDate', label: 'Data Udienza', default: true },
  { key: 'status', label: 'Stato', default: true },
  { key: 'statusDate', label: 'Data Stato', default: true },
  { key: 'notes', label: 'Note', default: true },
  { key: 'archived', label: 'Archiviato', default: true },
  { key: 'createdBy', label: 'Creato Da', default: false },
  { key: 'updatedBy', label: 'Modificato Da', default: false },
  { key: 'createdAt', label: 'Data Creazione', default: false },
  { key: 'updatedAt', label: 'Data Modifica', default: false }
];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [filters, setFilters] = useState<ExportFilters>({
    format: 'csv',
    monthYear: '',
    status: '',
    ownerInitials: '',
    court: '',
    startDate: '',
    endDate: '',
    includeArchived: false,
    includeColumns: allColumns.filter(col => col.default).map(col => col.key)
  });

  const [availableInitials, setAvailableInitials] = useState<string[]>([]);
  const [availableCourts, setAvailableCourts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFilterOptions();
    }
  }, [isOpen]);

  const fetchFilterOptions = async () => {
    setLoading(true);
    try {
      // Fetch available initials from users
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const initials = new Set<string>();
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.initials) {
          initials.add(userData.initials);
        }
      });
      setAvailableInitials(Array.from(initials).sort());

      // Fetch available courts from deadlines
      const deadlinesQuery = query(collection(db, 'deadlines'));
      const deadlinesSnapshot = await getDocs(deadlinesQuery);
      const courts = new Set<string>();
      deadlinesSnapshot.forEach(doc => {
        const deadlineData = doc.data();
        if (deadlineData.court && !deadlineData.deleted) {
          courts.add(deadlineData.court);
        }
      });
      setAvailableCourts(Array.from(courts).sort());
    } catch (error) {
      console.error('Error fetching filter options:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportDataFn = httpsCallable(functions, 'exportData');
      // Clean and prepare export parameters
      const exportParams: any = {
        format: filters.format,
        includeArchived: filters.includeArchived
      };

      // Only add non-empty filter parameters
      if (filters.monthYear && filters.monthYear.trim()) {
        exportParams.monthYear = filters.monthYear.trim();
      }
      if (filters.status && filters.status.trim()) {
        exportParams.status = filters.status.trim();
      }
      if (filters.ownerInitials && filters.ownerInitials.trim()) {
        exportParams.ownerInitials = filters.ownerInitials.trim();
      }
      if (filters.court && filters.court.trim()) {
        exportParams.court = filters.court.trim();
      }
      if (filters.startDate && filters.startDate.trim()) {
        exportParams.startDate = filters.startDate.trim();
      }
      if (filters.endDate && filters.endDate.trim()) {
        exportParams.endDate = filters.endDate.trim();
      }
      if (filters.includeColumns && filters.includeColumns.length > 0) {
        exportParams.includeColumns = filters.includeColumns;
      }

      console.log('Sending export request with params:', exportParams);

      const result = await exportDataFn(exportParams);
      
      // Create blob and download
      const blob = new Blob([result.data as string], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filterSuffix = filters.monthYear ? `_${filters.monthYear}` : '';
      a.download = `scadenzario${filterSuffix}_${timestamp}.csv`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      onClose();
    } catch (error) {
      console.error('Error exporting data:', error);
      
      // Show specific error message
      if (error instanceof Error) {
        alert(`Errore durante l'esportazione: ${error.message}`);
      } else {
        alert('Errore durante l\'esportazione dei dati - controlla i log per dettagli');
      }
    } finally {
      setExporting(false);
    }
  };

  const handleColumnToggle = (columnKey: string) => {
    setFilters(prev => ({
      ...prev,
      includeColumns: prev.includeColumns.includes(columnKey)
        ? prev.includeColumns.filter(col => col !== columnKey)
        : [...prev.includeColumns, columnKey]
    }));
  };

  const resetFilters = () => {
    setFilters({
      format: 'csv',
      monthYear: '',
      status: '',
      ownerInitials: '',
      court: '',
      startDate: '',
      endDate: '',
      includeArchived: false,
      includeColumns: allColumns.filter(col => col.default).map(col => col.key)
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">Esporta Dati CSV</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Filtri di base */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Filtri</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mese/Anno
                  </label>
                  <input
                    type="month"
                    value={filters.monthYear}
                    onChange={(e) => setFilters(prev => ({ ...prev, monthYear: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stato
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as DeadlineStatus | '' }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Tutti gli stati</option>
                    {Object.values(DeadlineStatusEnum).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Iniziali
                  </label>
                  <select
                    value={filters.ownerInitials}
                    onChange={(e) => setFilters(prev => ({ ...prev, ownerInitials: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Tutte le iniziali</option>
                    {availableInitials.map(initial => (
                      <option key={initial} value={initial}>{initial}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ufficio
                  </label>
                  <select
                    value={filters.court}
                    onChange={(e) => setFilters(prev => ({ ...prev, court: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Tutti gli uffici</option>
                    {availableCourts.map(court => (
                      <option key={court} value={court}>{court}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filtri per data */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Range Date</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inizio
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fine
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    id="includeArchived"
                    type="checkbox"
                    checked={filters.includeArchived}
                    onChange={(e) => setFilters(prev => ({ ...prev, includeArchived: e.target.checked }))}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeArchived" className="ml-2 block text-sm text-gray-700">
                    Includi elementi archiviati
                  </label>
                </div>
              </div>
            </div>

            {/* Selezione colonne */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Colonne da Esportare</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allColumns.map(column => (
                  <div key={column.key} className="flex items-center">
                    <input
                      id={column.key}
                      type="checkbox"
                      checked={filters.includeColumns.includes(column.key)}
                      onChange={() => handleColumnToggle(column.key)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor={column.key} className="ml-2 block text-sm text-gray-700">
                      {column.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Azioni */}
            <div className="flex justify-between">
              <button
                onClick={resetFilters}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Reset Filtri
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting || filters.includeColumns.length === 0}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                >
                  {exporting ? 'Esportazione...' : 'Esporta CSV'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};