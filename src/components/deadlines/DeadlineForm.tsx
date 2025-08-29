import React, { useState, useEffect } from 'react';
import { addDoc, updateDoc, doc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { Deadline, DeadlineStatus, STATUS_DISPLAY_MAP } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

interface DeadlineFormProps {
  deadline: Deadline | null;
  onClose: () => void;
}

export const DeadlineForm: React.FC<DeadlineFormProps> = ({ deadline, onClose }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    ownerInitials: deadline?.ownerInitials || user?.initials || '',
    matter: deadline?.matter || '',
    court: deadline?.court || '',
    rg: deadline?.rg || '',
    actType: deadline?.actType || '',
    hearingDate: deadline ? format(deadline.hearingDate.toDate(), 'yyyy-MM-dd') : '',
    status: deadline?.status || '',
    statusDate: deadline?.statusDate ? format(deadline.statusDate.toDate(), 'yyyy-MM-dd') : '',
    notes: deadline?.notes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const calculateMonthYear = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate RG format
      if (!formData.rg.match(/^\d{1,6}\/\d{4}$/)) {
        throw new Error('Formato RG non valido. Usa il formato: 123/2025');
      }

      const hearingDate = new Date(formData.hearingDate);
      const monthYear = calculateMonthYear(hearingDate);

      const deadlineData = {
        monthYear,
        ownerInitials: formData.ownerInitials.toUpperCase(),
        matter: formData.matter,
        court: formData.court.toUpperCase(),
        rg: formData.rg,
        actType: formData.actType.toUpperCase(),
        hearingDate: Timestamp.fromDate(hearingDate),
        status: formData.status as DeadlineStatus || null,
        statusDate: formData.statusDate ? Timestamp.fromDate(new Date(formData.statusDate)) : null,
        notes: formData.notes,
        archived: false,
        deleted: false,
        updatedAt: serverTimestamp(),
      };

      if (deadline) {
        // Update existing deadline
        await updateDoc(doc(db, 'deadlines', deadline.id!), {
          ...deadlineData,
          updatedBy: user?.uid,
        });
      } else {
        // Create new deadline
        await addDoc(collection(db, 'deadlines'), {
          ...deadlineData,
          createdBy: user?.uid,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {deadline ? 'Modifica Atto' : 'Nuovo Atto Processuale'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ownerInitials" className="block text-sm font-medium text-gray-700">
                Iniziali*
              </label>
              <input
                type="text"
                id="ownerInitials"
                name="ownerInitials"
                value={formData.ownerInitials}
                onChange={handleChange}
                maxLength={2}
                required
                disabled={user?.role === 'standard' && !deadline}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm uppercase disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="rg" className="block text-sm font-medium text-gray-700">
                RG* (es. 506/2025)
              </label>
              <input
                type="text"
                id="rg"
                name="rg"
                value={formData.rg}
                onChange={handleChange}
                required
                placeholder="123/2025"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="matter" className="block text-sm font-medium text-gray-700">
              Pratica*
            </label>
            <input
              type="text"
              id="matter"
              name="matter"
              value={formData.matter}
              onChange={handleChange}
              required
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="court" className="block text-sm font-medium text-gray-700">
              Ufficio*
            </label>
            <input
              type="text"
              id="court"
              name="court"
              value={formData.court}
              onChange={handleChange}
              required
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="actType" className="block text-sm font-medium text-gray-700">
              Tipo Atto*
            </label>
            <input
              type="text"
              id="actType"
              name="actType"
              value={formData.actType}
              onChange={handleChange}
              required
              placeholder="COMPARSA DI COSTITUZIONE"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hearingDate" className="block text-sm font-medium text-gray-700">
                Data Udienza*
              </label>
              <input
                type="date"
                id="hearingDate"
                name="hearingDate"
                value={formData.hearingDate}
                onChange={handleChange}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Stato
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="">Seleziona...</option>
                {Object.entries(STATUS_DISPLAY_MAP).map(([key, values]) => (
                  <option key={key} value={key}>
                    {values[0]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="statusDate" className="block text-sm font-medium text-gray-700">
              Data Stato
            </label>
            <input
              type="date"
              id="statusDate"
              name="statusDate"
              value={formData.statusDate}
              onChange={handleChange}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Note
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? 'Salvataggio...' : 'Salva e Chiudi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};