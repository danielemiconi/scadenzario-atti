import React, { useState, useEffect } from 'react';
import { type DeadlineFilter, DeadlineStatus } from '../../types';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';

interface DeadlineFiltersProps {
  filters: DeadlineFilter;
  onFiltersChange: (filters: DeadlineFilter) => void;
}

export const DeadlineFilters: React.FC<DeadlineFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [courts, setCourts] = useState<string[]>([]);
  const [initials, setInitials] = useState<string[]>([]);
  const [monthYears, setMonthYears] = useState<string[]>([]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      const deadlinesSnapshot = await getDocs(query(collection(db, 'deadlines')));
      
      const uniqueCourts = new Set<string>();
      const uniqueInitials = new Set<string>();
      const uniqueMonthYears = new Set<string>();
      
      deadlinesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.court) uniqueCourts.add(data.court);
        if (data.ownerInitials) uniqueInitials.add(data.ownerInitials);
        if (data.monthYear) uniqueMonthYears.add(data.monthYear);
      });
      
      setCourts(Array.from(uniqueCourts).sort());
      setInitials(Array.from(uniqueInitials).sort());
      setMonthYears(Array.from(uniqueMonthYears).sort());
    };

    fetchFilterOptions();
  }, []);

  const handleFilterChange = (key: keyof DeadlineFilter, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const monthNames: Record<string, string> = {
    '01': 'Gennaio',
    '02': 'Febbraio',
    '03': 'Marzo',
    '04': 'Aprile',
    '05': 'Maggio',
    '06': 'Giugno',
    '07': 'Luglio',
    '08': 'Agosto',
    '09': 'Settembre',
    '10': 'Ottobre',
    '11': 'Novembre',
    '12': 'Dicembre',
  };

  const formatMonthYear = (monthYear: string): string => {
    const [year, month] = monthYear.split('-');
    return `${monthNames[month]} ${year}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <label htmlFor="monthYear" className="block text-sm font-medium text-gray-700">
            Mese/Anno
          </label>
          <select
            id="monthYear"
            value={filters.monthYear || ''}
            onChange={(e) => handleFilterChange('monthYear', e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value="">Tutti</option>
            {monthYears.map((my) => (
              <option key={my} value={my}>
                {formatMonthYear(my)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="initials" className="block text-sm font-medium text-gray-700">
            Iniziali
          </label>
          <select
            id="initials"
            value={filters.ownerInitials || ''}
            onChange={(e) => handleFilterChange('ownerInitials', e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value="">Tutte</option>
            {initials.map((ini) => (
              <option key={ini} value={ini}>
                {ini}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="court" className="block text-sm font-medium text-gray-700">
            Ufficio
          </label>
          <select
            id="court"
            value={filters.court || ''}
            onChange={(e) => handleFilterChange('court', e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value="">Tutti</option>
            {courts.map((court) => (
              <option key={court} value={court}>
                {court}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Stato
          </label>
          <select
            id="status"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value as DeadlineStatus)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          >
            <option value="">Tutti</option>
            {Object.values(DeadlineStatus).map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">
            Cerca
          </label>
          <input
            type="text"
            id="search"
            value={filters.searchText || ''}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
            placeholder="RG, pratica, note..."
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.archived || false}
            onChange={(e) => handleFilterChange('archived', e.target.checked)}
            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Mostra archiviati</span>
        </label>

        <button
          onClick={() => onFiltersChange({})}
          className="text-sm text-green-600 hover:text-green-500"
        >
          Reimposta filtri
        </button>
      </div>
    </div>
  );
};