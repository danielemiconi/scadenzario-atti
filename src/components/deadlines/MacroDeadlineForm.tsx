import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { type MacroDeadline, DeadlineStatus, STATUS_DISPLAY_MAP } from '../../types';
import { calculateMacroDeadlines, formatDeadlineDate, calculateDaysRemaining, type DeadlineCalculation } from '../../utils/legalDeadlines';
import { createMacroDeadlines } from '../../services/deadlineService';
import { useLegend } from '../../hooks/useLegend';

interface MacroDeadlineFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const MacroDeadlineForm: React.FC<MacroDeadlineFormProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { validInitials, loading: legendLoading } = useLegend();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [calculatedDeadlines, setCalculatedDeadlines] = useState<DeadlineCalculation[]>([]);
  const [customizedDeadlines, setCustomizedDeadlines] = useState<Map<string, Date>>(new Map());
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState({
    macroType: '171-ter' as MacroDeadline['macroType'],
    hearingDate: '',
    ownerInitials: '',
    matter: '',
    court: '',
    forum: '',
    rg: '',
    status: '',
    notes: '',
    includeSummerSuspension: true
  });

  const predefinedCourts = [
    'G.D.P.',
    'TRIB.',
    'C.A.P.',
    'CASS. CIV.',
    'CASS. PEN.',
    'T.A.R.',
    'C.D.S.',
    'CORTE GIUST.  TRIB. I°',
    'CORTE GIUST.  TRIB. II°.'
  ];

  const macroTypeLabels = {
    '171-ter': 'Art. 171-ter C.P.C. (Memorie integrative)',
    '189': 'Art. 189 C.P.C. (Precisazione conclusioni)',
    '281-duodecies': 'Art. 281-duodecies C.P.C. (Memorie)'
  };

  // Calcola le scadenze quando cambiano i parametri rilevanti
  useEffect(() => {
    if (formData.hearingDate) {
      const hearingDate = new Date(formData.hearingDate);
      const deadlines = calculateMacroDeadlines({
        type: formData.macroType,
        hearingDate,
        includeSummerSuspension: formData.includeSummerSuspension
      });
      setCalculatedDeadlines(deadlines);
    } else {
      setCalculatedDeadlines([]);
    }
  }, [formData.hearingDate, formData.macroType, formData.includeSummerSuspension]);

  // Imposta automaticamente l'ufficio su TRIB. per macro 171-ter e 189
  useEffect(() => {
    if (formData.macroType === '171-ter' || formData.macroType === '189') {
      setFormData(prevData => ({
        ...prevData,
        court: 'TRIB.'
      }));
    } else if (formData.macroType === '281-duodecies') {
      // Reset del campo se il valore attuale non è valido per 281-duodecies
      if (formData.court && formData.court !== 'G.D.P.' && formData.court !== 'TRIB.') {
        setFormData(prevData => ({
          ...prevData,
          court: ''
        }));
      }
    }
  }, [formData.macroType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: target.checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: (name === 'matter' || name === 'forum') ? value.toUpperCase() : value,
      });
    }
  };

  const validateForm = (): boolean => {
    if (!formData.hearingDate) {
      setError('La data udienza è obbligatoria');
      return false;
    }
    
    if (!formData.ownerInitials) {
      setError('Le iniziali sono obbligatorie');
      return false;
    }
    
    if (!validInitials.includes(formData.ownerInitials)) {
      setError('Le iniziali selezionate non sono valide. Seleziona dalle opzioni disponibili nella legenda.');
      return false;
    }
    
    if (!formData.matter) {
      setError('La pratica è obbligatoria');
      return false;
    }
    
    if (!formData.court) {
      setError('L\'ufficio è obbligatorio');
      return false;
    }
    
    if (!formData.rg) {
      setError('Il ruolo generale è obbligatorio');
      return false;
    }
    
    if (!formData.rg.match(/^\d{1,6}\/\d{4}$/)) {
      setError('Formato RG non valido. Usa il formato: 123/2025');
      return false;
    }
    
    return true;
  };

  const handlePreview = () => {
    if (validateForm()) {
      // Inizializza le date personalizzate con quelle calcolate
      const customDates = new Map<string, Date>();
      calculatedDeadlines.forEach(deadline => {
        customDates.set(deadline.type, deadline.date);
      });
      setCustomizedDeadlines(customDates);
      setShowPreview(true);
      setError(null);
    }
  };

  const handleDateChange = (type: string, newDate: string) => {
    const updatedDates = new Map(customizedDeadlines);
    updatedDates.set(type, new Date(newDate));
    setCustomizedDeadlines(updatedDates);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const macro: MacroDeadline = {
        type: 'macro',
        macroType: formData.macroType,
        hearingDate: new Date(formData.hearingDate),
        commonData: {
          ownerInitials: formData.ownerInitials,
          matter: formData.matter,
          court: formData.court,
          forum: formData.forum || undefined,
          rg: formData.rg,
          status: formData.status as DeadlineStatus || undefined,
          notes: formData.notes || undefined
        },
        includeSummerSuspension: formData.includeSummerSuspension
      };
      
      // Usa le date personalizzate se disponibili, altrimenti quelle calcolate
      const finalDeadlines = calculatedDeadlines.map(calc => ({
        ...calc,
        date: customizedDeadlines.get(calc.type) || calc.date
      }));
      
      // Crea le scadenze con le date finali
      const result = await createMacroDeadlines({
        ...macro,
        customDeadlines: finalDeadlines
      } as any, user?.uid || '');
      
      if (result.success) {
        setSuccess(`Create ${result.created} scadenze con successo!`);
        
        // Mostra errori se ci sono scadenze duplicate
        if (result.errors.length > 0) {
          const errorMessages = result.errors.map(e => `${e.deadline}: ${e.error}`).join('\n');
          setError(`Alcune scadenze non sono state create:\n${errorMessages}`);
        }
        
        // Chiudi dopo 2 secondi se tutto è andato bene
        if (result.errors.length === 0) {
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 2000);
        }
      } else {
        const errorMessages = result.errors.map(e => `${e.deadline}: ${e.error}`).join('\n');
        throw new Error(errorMessages || 'Errore durante la creazione delle scadenze');
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio');
    } finally {
      setIsLoading(false);
    }
  };

  const getDeadlineColor = (daysRemaining: number) => {
    if (daysRemaining < 0) return 'text-gray-500'; // Scaduto
    if (daysRemaining <= 7) return 'text-red-600'; // Urgente
    if (daysRemaining <= 14) return 'text-yellow-600'; // Prossimo
    return 'text-green-600'; // Normale
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium text-gray-900">
            Inserimento Macro Scadenze Processuali
          </h3>
        </div>

        {!showPreview ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Selezione tipo macro */}
              <div>
                <label htmlFor="macroType" className="block text-sm font-medium text-gray-700">
                  Tipo di Macro*
                </label>
                <select
                  id="macroType"
                  name="macroType"
                  value={formData.macroType}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                >
                  {Object.entries(macroTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data udienza */}
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>

              {/* Sospensione feriale */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeSummerSuspension"
                  name="includeSummerSuspension"
                  checked={formData.includeSummerSuspension}
                  onChange={handleChange}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="includeSummerSuspension" className="ml-2 block text-sm text-gray-700">
                  Considera sospensione feriale (1-31 agosto)
                </label>
              </div>

              {/* Anteprima scadenze calcolate */}
              {calculatedDeadlines.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Scadenze che verranno create:</h4>
                  <ul className="space-y-1">
                    {calculatedDeadlines.map((deadline, index) => {
                      const daysRemaining = calculateDaysRemaining(deadline.date);
                      return (
                        <li key={index} className="text-sm">
                          <span className="font-medium">{deadline.type}:</span>{' '}
                          <span className={getDeadlineColor(daysRemaining)}>
                            {formatDeadlineDate(deadline.date)}
                          </span>
                          {' '}
                          <span className="text-gray-500">
                            ({daysRemaining > 0 ? `tra ${daysRemaining} giorni` : 
                              daysRemaining === 0 ? 'oggi' : 
                              `${Math.abs(daysRemaining)} giorni fa`})
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Dati comuni per tutte le scadenze</h4>
                
                {/* Iniziali e RG */}
                <div className="grid grid-cols-2 gap-4 mb-4">
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
                      Ruolo Generale*
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

                {/* Pratica */}
                <div className="mb-4">
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

                {/* Ufficio e Foro */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="court" className="block text-sm font-medium text-gray-700">
                      Ufficio* {(formData.macroType === '171-ter' || formData.macroType === '189') && <span className="text-xs text-blue-600">(automatico per {formData.macroType})</span>}
                      {formData.macroType === '281-duodecies' && <span className="text-xs text-green-600">(solo G.d.P. o Tribunale)</span>}
                    </label>
                    <select
                      id="court"
                      name="court"
                      value={formData.court}
                      onChange={handleChange}
                      required
                      disabled={formData.macroType === '171-ter' || formData.macroType === '189'}
                      className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm ${
                        (formData.macroType === '171-ter' || formData.macroType === '189') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">Seleziona...</option>
                      {(formData.macroType === '281-duodecies' 
                        ? predefinedCourts.filter(court => court === 'G.D.P.' || court === 'TRIB.')
                        : predefinedCourts
                      ).map((court) => (
                        <option key={court} value={court}>
                          {court}
                        </option>
                      ))}
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

                {/* Stato */}
                <div className="mb-4">
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Stato iniziale
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

                {/* Note */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Note aggiuntive
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Queste note verranno aggiunte a tutte le scadenze create"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm italic"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-800 whitespace-pre-line">{error}</div>
                </div>
              )}

              {success && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-800">{success}</div>
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
                type="button"
                onClick={handlePreview}
                disabled={!formData.hearingDate || isLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Anteprima e Conferma
              </button>
            </div>
          </div>
        ) : (
          // Vista anteprima
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-yellow-900 mb-2">
                  Conferma creazione scadenze
                </h4>
                <p className="text-sm text-yellow-700">
                  Stai per creare {calculatedDeadlines.length} scadenze per {macroTypeLabels[formData.macroType]}.
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-50 rounded-md p-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="font-medium text-gray-500">Pratica:</dt>
                      <dd className="text-gray-900">{formData.matter}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">RG:</dt>
                      <dd className="text-gray-900">{formData.rg}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Ufficio:</dt>
                      <dd className="text-gray-900">{formData.court}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Foro:</dt>
                      <dd className="text-gray-900">{formData.forum || '-'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Data Udienza:</dt>
                      <dd className="text-gray-900">
                        {format(new Date(formData.hearingDate), 'dd MMMM yyyy', { locale: it })}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500">Iniziali:</dt>
                      <dd className="text-gray-900">{formData.ownerInitials.toUpperCase()}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Scadenze da creare (modificabili):</h4>
                  <div className="bg-white border border-gray-200 rounded-md divide-y divide-gray-200">
                    {calculatedDeadlines.map((deadline, index) => {
                      const currentDate = customizedDeadlines.get(deadline.type) || deadline.date;
                      const daysRemaining = calculateDaysRemaining(currentDate);
                      return (
                        <div key={index} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{deadline.type}</p>
                              <p className="text-xs text-gray-500">{deadline.description}</p>
                            </div>
                            <div className="flex items-center space-x-4">
                              <input
                                type="date"
                                value={format(currentDate, 'yyyy-MM-dd')}
                                onChange={(e) => handleDateChange(deadline.type, e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                              />
                              <div className="text-right min-w-[100px]">
                                <p className={`text-sm font-medium ${getDeadlineColor(daysRemaining)}`}>
                                  {formatDeadlineDate(currentDate)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {daysRemaining > 0 ? `tra ${daysRemaining} giorni` : 
                                   daysRemaining === 0 ? 'oggi' : 
                                   `${Math.abs(daysRemaining)} giorni fa`}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Puoi modificare le date cliccando sul campo data di ciascuna scadenza
                  </p>
                </div>
              </div>

              {error && (
                <div className="px-6">
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-800 whitespace-pre-line">{error}</div>
                  </div>
                </div>
              )}

              {success && (
                <div className="px-6">
                  <div className="rounded-md bg-green-50 p-4">
                    <div className="text-sm text-green-800">{success}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Modifica
              </button>
              <div className="space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isLoading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isLoading ? 'Creazione in corso...' : 'Crea Scadenze'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};