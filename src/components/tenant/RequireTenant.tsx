import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTenantSetup, TenantSetupState } from '../../hooks/useTenantSetup';
import { TenantPicker } from './TenantPicker';

interface RequireTenantProps {
  children: React.ReactNode;
}

export const RequireTenant: React.FC<RequireTenantProps> = ({ children }) => {
  const { state, error, needsSelection } = useTenantSetup();

  // Still loading
  if (state === TenantSetupState.LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // No tenants available
  if (state === TenantSetupState.NO_TENANTS) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Registrazione in Attesa
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {error?.message || 'La tua registrazione è in attesa di approvazione.'}
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Un amministratore deve invitarti per poter accedere al sistema.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Se hai già ricevuto un invito, assicurati di aver usato la stessa email.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Torna al Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Multiple tenants but none selected
  if (needsSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Seleziona Studio Legale
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Hai accesso a più studi. Seleziona quello con cui vuoi lavorare.
            </p>
          </div>
          <div className="mt-8">
            <TenantPicker className="w-full" showLabel={false} />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state === TenantSetupState.ERROR) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Errore di Configurazione
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {error?.message || 'Si è verificato un errore nel caricamento del tenant.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tenant selected - render children
  return <>{children}</>;
};