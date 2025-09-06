import React, { useState } from 'react';
import { addDoc, updateDoc, doc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { type Deadline, DeadlineStatus, STATUS_DISPLAY_MAP } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { useLegend } from '../../hooks/useLegend';

interface DeadlineFormProps {
  deadline: Deadline | null;
  isCloning?: boolean;
  onClose: () => void;
}

export const DeadlineForm: React.FC<DeadlineFormProps> = ({ deadline, isCloning = false, onClose }) => {
  const { user } = useAuth();
  const { validInitials, loading: legendLoading } = useLegend();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    ownerInitials: deadline?.ownerInitials || '',
    matter: deadline?.matter || '',
    court: deadline?.court || '',
    forum: deadline?.forum || '',
    rg: deadline?.rg || '',
    actType: deadline?.actType || '',
    // Se stiamo clonando, mantenere hearingDate dall'originale
    hearingDate: deadline?.hearingDate ? format(deadline.hearingDate.toDate(), 'yyyy-MM-dd') : '',
    status: deadline?.status || '',
    // Se stiamo clonando, NON pre-compilare statusDate (deve essere vuoto)
    statusDate: (isCloning || !deadline?.statusDate) ? '' : format(deadline.statusDate.toDate(), 'yyyy-MM-dd'),
    notes: deadline?.notes || '',
  });
  
  const predefinedActTypes = [
    'ATTO DI APPELLO',
    'ATTO DI CITAZIONE',
    'ATTO DI CITAZIONE IN OPPOSIZIONE ATTI ESECUTIVI',
    'ATTO DI CITAZIONE IN OPPOSIZIONE ALL\'ESECUZIONE',
    'ATTO DI PRECETTO',
    'COMPARSA A SEGUITO DI RIASSUNZIONE',
    'COMPARSA DI COSTITUZIONE E RISPOSTA',
    'COMPARSA DI COSTITUZIONE E RISPOSTA IN APPELLO',
    'FOGLIO DI PRECISAZIONE DELLE CONCLUSIONI',
    'ISTANZA',
    'MEMORIA',
    'MEMORIA 171-TER 1° TERMINE',
    'MEMORIA 171-TER 2° TERMINE',
    'MEMORIA 171-TER 3° TERMINE',
    'MEMORIA 189 1° TERMINE (P.C.)',
    'MEMORIA 189 2° TERMINE (CONCLUSIONALE)',
    'MEMORIA 189 3° TERMINE C.P.C. (REPLICHE)',
    'MEMORIA 281-DUODECIES 1° TERMINE',
    'MEMORIA 281-DUODECIES 2° TERMINE',
    'NOTA DI DEPOSITO',
    'NOTE SCRITTE D\'UDIENZA 127-TER',
    'OPPOSIZIONE A DECRETO INGIUNTIVO',
    'OPPOSIZIONE A DECRETO INGIUNTIVO TARDIVA EX ART. 650 C.P.C.',
    'RICORSO IN CASSAZIONE',
    'RICORSO IN OPPOSIZIONE ATTI ESECUTIVI',
    'RICORSO IN OPPOSIZIONE ALL\'ESECUZIONE',
    'RICORSO PER CASSAZIONE',
    'RICORSO PER DECRETO INGIUNTIVO',
    'RICORSO SEMPLIFICATO COGNZIONE'
  ];

  const [isCustomActType, setIsCustomActType] = useState(() => {
    // Check if the existing actType is in the predefined options
    if (deadline?.actType) {
      return !predefinedActTypes.includes(deadline.actType);
    }
    return false;
  });
  
  const [customActType, setCustomActType] = useState(() => {
    if (deadline?.actType) {
      return !predefinedActTypes.includes(deadline.actType) ? deadline.actType : '';
    }
    return '';
  });

  const actTypeOptions = predefinedActTypes;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'actType') {
      if (value === 'ALTRO') {
        setIsCustomActType(true);
        setFormData({
          ...formData,
          actType: '',
        });
      } else {
        setIsCustomActType(false);
        setCustomActType('');
        setFormData({
          ...formData,
          actType: value,
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: (name === 'matter' || name === 'forum') ? value.toUpperCase() : value,
      });
    }
  };

  const handleCustomActTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomActType(value);
    setFormData({
      ...formData,
      actType: value,
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

      // Validate owner initials
      if (!formData.ownerInitials) {
        throw new Error('Le iniziali sono obbligatorie');
      }
      
      if (!validInitials.includes(formData.ownerInitials)) {
        throw new Error('Le iniziali selezionate non sono valide. Seleziona dalle opzioni disponibili nella legenda.');
      }

      // Calculate monthYear usando statusDate (sempre presente) o hearingDate come fallback
      const statusDate = new Date(formData.statusDate);
      const monthYear = calculateMonthYear(statusDate);
      
      // Dati base comuni per create e update (senza archived/deleted)
      const baseDeadlineData = {
        monthYear,
        ownerInitials: formData.ownerInitials.toUpperCase(),
        matter: formData.matter,
        court: formData.court,
        forum: formData.forum,
        rg: formData.rg,
        actType: formData.actType.toUpperCase(),
        hearingDate: formData.hearingDate ? Timestamp.fromDate(new Date(formData.hearingDate)) : null,
        status: formData.status as DeadlineStatus || null,
        statusDate: Timestamp.fromDate(statusDate),
        notes: formData.notes,
        updatedAt: serverTimestamp(),
      };

      if (deadline && !isCloning) {
        // Update existing deadline - NON modificare archived/deleted
        await updateDoc(doc(db, 'deadlines', deadline.id!), {
          ...baseDeadlineData,
          updatedBy: user?.uid,
        });
      } else {
        // Create new deadline (anche nel caso di clonazione)
        await addDoc(collection(db, 'deadlines'), {
          ...baseDeadlineData,
          archived: false,
          deleted: false,
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
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium text-gray-900">
            {isCloning ? 'Clona Atto' : deadline ? 'Modifica Atto' : 'Nuovo Atto Processuale'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ownerInitials" className="block text-sm font-medium text-gray-700">
                Iniziali*
              </label>
              {legendLoading ? (
                <div className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm py-2 px-3 bg-gray-50 text-gray-500">
                  Caricamento iniziali...
                </div>
              ) : validInitials.length === 0 ? (
                <div className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500">
                  Nessuna iniziale disponibile nella legenda
                </div>
              ) : (
                <select
                  id="ownerInitials"
                  name="ownerInitials"
                  value={formData.ownerInitials}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                >
                  <option value="">Seleziona...</option>
                  {validInitials.map((initials) => (
                    <option key={initials} value={initials}>
                      {initials}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="rg" className="block text-sm font-medium text-gray-700">
                Ruolo Generale
              </label>
              <input
                type="text"
                id="rg"
                name="rg"
                value={formData.rg}
                onChange={handleChange}
                required
                placeholder="123/2025"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="court" className="block text-sm font-medium text-gray-700">
                Ufficio*
              </label>
              <select
                id="court"
                name="court"
                value={formData.court}
                onChange={handleChange}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              >
                <option value="">Seleziona...</option>
                <option value="G.D.P.">G.D.P.</option>
                <option value="TRIB.">TRIB.</option>
                <option value="C.A.P.">C.A.P.</option>
                <option value="CASS. CIV.">CASS. CIV.</option>
                <option value="CASS. PEN.">CASS. PEN.</option>
                <option value="T.A.R.">T.A.R.</option>
                <option value="C.D.S.">C.D.S.</option>
                <option value="CORTE GIUST.  TRIB. I°">CORTE GIUST.  TRIB. I°</option>
                <option value="CORTE GIUST.  TRIB. II°.">CORTE GIUST.  TRIB. II°.</option>
              </select>
            </div>
            <div>
              <label htmlFor="forum" className="block text-sm font-medium text-gray-700">
                Foro
              </label>
              <input
                type="text"
                id="forum"
                name="forum"
                value={formData.forum}
                onChange={handleChange}
                placeholder="es. Roma, Milano, Napoli"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="actType" className="block text-sm font-medium text-gray-700">
              Tipo Atto*
            </label>
            <select
              id="actType"
              name="actType"
              value={isCustomActType ? 'ALTRO' : formData.actType}
              onChange={handleChange}
              required
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
            >
              <option value="">Seleziona...</option>
              <option value="ALTRO">ALTRO</option>
              {actTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            
            {isCustomActType && (
              <input
                type="text"
                id="customActType"
                name="customActType"
                value={customActType}
                onChange={handleCustomActTypeChange}
                required
                placeholder="Inserisci tipo atto personalizzato"
                className="mt-2 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hearingDate" className="block text-sm font-medium text-gray-700">
                Data Udienza
              </label>
              <input
                type="date"
                id="hearingDate"
                name="hearingDate"
                value={formData.hearingDate}
                onChange={handleChange}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
              Data Scadenza*
            </label>
            <input
              type="date"
              id="statusDate"
              name="statusDate"
              value={formData.statusDate}
              onChange={handleChange}
              required
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm italic"
            />
          </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isLoading ? 'Salvataggio...' : isCloning ? 'Clona e Chiudi' : 'Salva e Chiudi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};