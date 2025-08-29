import React from 'react';
import { Deadline, DeadlineStatus, STATUS_DISPLAY_MAP } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';

interface DeadlineListProps {
  deadlines: Deadline[];
  onEdit: (deadline: Deadline) => void;
}

export const DeadlineList: React.FC<DeadlineListProps> = ({ deadlines, onEdit }) => {
  const { user } = useAuth();

  const handleDelete = async (deadlineId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo atto?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'deadlines', deadlineId));
    } catch (error) {
      console.error('Error deleting deadline:', error);
      alert('Errore durante l\'eliminazione dell\'atto');
    }
  };

  const getStatusDisplay = (status?: DeadlineStatus): string => {
    if (!status) return '';
    return STATUS_DISPLAY_MAP[status]?.[0] || status;
  };

  const getStatusColor = (status?: DeadlineStatus): string => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status) {
      case DeadlineStatus.DEPOSITATO:
        return 'bg-green-100 text-green-800';
      case DeadlineStatus.FATTO:
        return 'bg-blue-100 text-blue-800';
      case DeadlineStatus.RINVIATA:
        return 'bg-yellow-100 text-yellow-800';
      case DeadlineStatus.NOTIFICATO:
        return 'bg-purple-100 text-purple-800';
      case DeadlineStatus.PENDENTE:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
              RG
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo Atto
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              UD.
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stato
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Data Stato
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
              <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {deadline.ownerInitials}
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.matter}
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.court}
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                {deadline.rg}
              </td>
              <td className="px-3 py-4 text-sm text-gray-900">
                {deadline.actType}
              </td>
              <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                {format(deadline.hearingDate.toDate(), 'dd.MM.yy')}
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
              <td className="px-3 py-4 whitespace-nowrap text-sm font-medium no-print">
                <button
                  onClick={() => onEdit(deadline)}
                  className="text-primary-600 hover:text-primary-900 mr-3"
                >
                  Modifica
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleDelete(deadline.id!)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Elimina
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};