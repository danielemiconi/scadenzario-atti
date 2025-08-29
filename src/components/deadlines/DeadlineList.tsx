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
}

export const DeadlineList: React.FC<DeadlineListProps> = ({ deadlines, onEdit }) => {
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
              Note
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Scadenza
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
                {deadline.statusDate && format(deadline.statusDate.toDate(), 'dd.MM.yy')}
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.notes}
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm font-bold">
                <div className={`px-2 py-1 rounded text-center ${getDeadlineHighlight(deadline.hearingDate.toDate())}`}>
                  {format(deadline.hearingDate.toDate(), 'dd.MM.yy')}
                </div>
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm font-medium no-print">
                <button
                  onClick={() => onEdit(deadline)}
                  className="text-green-600 hover:text-green-900 mr-3 p-1 rounded hover:bg-green-50"
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
                {(user?.role === 'admin' || user?.email === 'daniele.miconi@iblegal.it') && (
                  <div className="inline-flex space-x-2">
                    <button
                      onClick={() => handleArchive(deadline.id!, deadline.archived)}
                      disabled={loadingStates[deadline.id!] === 'archiving'}
                      className={`text-blue-600 hover:text-blue-900 disabled:opacity-50 ${
                        deadline.archived ? 'text-orange-600 hover:text-orange-900' : ''
                      }`}
                    >
                      {loadingStates[deadline.id!] === 'archiving' 
                        ? '...' 
                        : deadline.archived 
                          ? 'Ripristina'
                          : 'Archivia'
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(deadline.id!)}
                      disabled={loadingStates[deadline.id!] === 'deleting'}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      {loadingStates[deadline.id!] === 'deleting' ? '...' : 'Elimina'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};