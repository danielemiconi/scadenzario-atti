import React, { useState } from 'react';
import { type Deadline, DeadlineStatus, STATUS_DISPLAY_MAP } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/config';
import { useLegendColors } from '../../hooks/useLegendColors';

interface DeadlineListProps {
  deadlines: Deadline[];
  onEdit: (deadline: Deadline) => void;
  onClone: (deadline: Deadline) => void;
}

export const DeadlineList: React.FC<DeadlineListProps> = ({ deadlines, onEdit, onClone }) => {
  const { user } = useAuth();
  const { getColors } = useLegendColors();
  const [loadingStates, setLoadingStates] = useState<Record<string, 'deleting' | 'archiving' | null>>({});


  const handleDelete = async (deadlineId: string) => {
    if (!confirm('Sei sicuro di voler spostare questo atto nel cestino?')) {
      return;
    }

    setLoadingStates(prev => ({ ...prev, [deadlineId]: 'deleting' }));

    try {
      console.log('Attempting to soft delete deadline:', deadlineId);
      
      const softDeleteFunction = httpsCallable(functions, 'softDeleteDeadline');
      await softDeleteFunction({ deadlineId });
      
      console.log('Successfully soft deleted deadline:', deadlineId);
      // Show success message
      alert('Atto spostato nel cestino con successo');
    } catch (error) {
      console.error('Error soft deleting deadline:', error);
      
      // More detailed error message
      if (error instanceof Error) {
        alert(`Errore durante l'eliminazione dell'atto: ${error.message}`);
      } else {
        alert('Errore durante l\'eliminazione dell\'atto - dettagli nella console');
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, [deadlineId]: null }));
    }
  };

  const handleArchive = async (deadlineId: string, currentlyArchived: boolean) => {
    const action = currentlyArchived ? 'ripristinare' : 'archiviare';
    if (!confirm(`Sei sicuro di voler ${action} questo atto?`)) {
      return;
    }

    setLoadingStates(prev => ({ ...prev, [deadlineId]: 'archiving' }));

    try {
      const archiveFunction = httpsCallable(functions, 'archiveDeadline');
      await archiveFunction({
        deadlineId: deadlineId,
        archived: !currentlyArchived
      });
      
      const successMessage = currentlyArchived ? 'Atto ripristinato con successo' : 'Atto archiviato con successo';
      alert(successMessage);
    } catch (error) {
      console.error('Error archiving deadline:', error);
      if (error instanceof Error) {
        alert(`Errore durante l'${action}: ${error.message}`);
      } else {
        alert(`Errore durante l'${action} - dettagli nella console`);
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, [deadlineId]: null }));
    }
  };

  const getStatusDisplay = (status?: DeadlineStatus): string => {
    if (!status) return '';
    return STATUS_DISPLAY_MAP[status]?.[0] || status;
  };

  const getStatusColor = (status?: DeadlineStatus): string => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status) {
      case DeadlineStatus.FARE:
        return 'bg-red-100 text-red-800';
      case DeadlineStatus.NON_FARE:
        return 'bg-gray-100 text-gray-800';
      case DeadlineStatus.FATTO:
        return 'bg-blue-100 text-blue-800';
      case DeadlineStatus.DEPOSITARE:
        return 'bg-yellow-100 text-yellow-800';
      case DeadlineStatus.NOTIFICARE:
        return 'bg-orange-100 text-orange-800';
      case DeadlineStatus.DEPOSITATO:
        return 'bg-green-100 text-green-800';
      case DeadlineStatus.NOTIFICATO:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeadlineHighlight = (deadlineDate: Date): string => {
    const today = new Date();
    const timeDiff = deadlineDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) {
      return 'bg-red-200 text-red-900 border border-red-300';
    } else if (daysDiff <= 7) {
      return 'bg-red-100 text-red-800 border border-red-200';
    } else if (daysDiff <= 14) {
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    } else {
      return 'bg-green-100 text-green-800 border border-green-200';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ini
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pratica
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ufficio
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Foro
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              R.G.
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo Atto
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stato
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Data Udienza
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Data Scadenza
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Note
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider no-print">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {deadlines.map((deadline) => (
            <tr key={deadline.id} className="hover:bg-gray-50">
              <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                <div 
                  className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold rounded"
                  style={{
                    backgroundColor: getColors(deadline.ownerInitials).backgroundColor,
                    color: getColors(deadline.ownerInitials).textColor
                  }}
                >
                  {deadline.ownerInitials}
                </div>
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.matter}
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.court}
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.forum || ''}
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                {deadline.rg}
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.actType}
              </td>
              <td className="px-3 py-4 whitespace-nowrap">
                {deadline.status && (
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(deadline.status)}`}>
                    {getStatusDisplay(deadline.status)}
                  </span>
                )}
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                {deadline.hearingDate ? format(deadline.hearingDate.toDate(), 'dd.MM.yy') : '-'}
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm font-bold">
                <div className={`px-2 py-1 rounded text-center ${getDeadlineHighlight(deadline.statusDate ? deadline.statusDate.toDate() : new Date())}`}>
                  {deadline.statusDate ? format(deadline.statusDate.toDate(), 'dd.MM.yy') : '-'}
                </div>
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.notes}
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm font-medium no-print">
                <div className="inline-flex items-center space-x-2">
                  <button
                    onClick={() => onEdit(deadline)}
                    className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                    title="Modifica atto"
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      <path d="m15 5 4 4"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => onClone(deadline)}
                    className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                    title="Clona atto"
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="m5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                  {(user?.role === 'admin' || user?.email === 'daniele.miconi@iblegal.it') && (
                    <>
                      <button
                        onClick={() => handleArchive(deadline.id!, deadline.archived)}
                        disabled={loadingStates[deadline.id!] === 'archiving'}
                        className={`p-1 rounded disabled:opacity-50 ${
                          deadline.archived 
                            ? 'text-orange-600 hover:text-orange-900 hover:bg-orange-50' 
                            : 'text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50'
                        }`}
                        title={deadline.archived ? 'Ripristina atto' : 'Archivia atto'}
                      >
                        {loadingStates[deadline.id!] === 'archiving' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="15.708" strokeDashoffset="4" strokeLinecap="round"/>
                          </svg>
                        ) : deadline.archived ? (
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M3 3l18 18M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9M21 3H3l3 3h12l3-3Z"/>
                            <path d="m10 12 4-4"/>
                          </svg>
                        ) : (
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <rect x="2" y="3" width="20" height="5" rx="1"/>
                            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
                            <path d="M10 12h4"/>
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(deadline.id!)}
                        disabled={loadingStates[deadline.id!] === 'deleting'}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 p-1 rounded hover:bg-red-50"
                        title="Sposta nel cestino"
                      >
                        {loadingStates[deadline.id!] === 'deleting' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="15.708" strokeDashoffset="4" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};