import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { type Tenant } from '../../types';

interface TenantPickerProps {
  className?: string;
  showLabel?: boolean;
}

export const TenantPicker: React.FC<TenantPickerProps> = ({
  className = '',
  showLabel = true
}) => {
  const { user, tenants } = useAuth();
  const { currentTenant, setCurrentTenant, loading: tenantLoading } = useTenant();
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadTenants = async () => {
      if (!user || !tenants || tenants.length === 0) {
        setAvailableTenants([]);
        setLoading(false);
        return;
      }

      try {
        const tenantsList: Tenant[] = [];

        // Load tenant data for each tenant ID
        for (const tenantId of tenants) {
          const tenantDoc = await getDocs(
            query(collection(db, 'tenants'), where('__name__', '==', tenantId))
          );

          if (!tenantDoc.empty) {
            const data = tenantDoc.docs[0].data();
            tenantsList.push({
              id: tenantId,
              ...data
            } as Tenant);
          }
        }

        setAvailableTenants(tenantsList);
      } catch (error) {
        console.error('Error loading tenants:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTenants();
  }, [user, tenants]);

  const handleTenantChange = async (tenantId: string) => {
    try {
      await setCurrentTenant(tenantId);
      setIsOpen(false);
    } catch (error) {
      console.error('Error switching tenant:', error);
    }
  };

  // Don't show picker if user has only one tenant
  if (!tenants || tenants.length <= 1) {
    return null;
  }

  const currentTenantData = availableTenants.find(t => t.id === currentTenant);

  if (loading || tenantLoading) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="animate-pulse bg-gray-200 h-8 w-32 rounded"></div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Studio Attivo
        </label>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        disabled={tenantLoading}
      >
        <span className="flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          {currentTenantData?.name || 'Seleziona Studio'}
        </span>
        <svg
          className={`w-5 h-5 ml-2 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <ul className="py-1">
            {availableTenants.map((tenant) => (
              <li key={tenant.id}>
                <button
                  onClick={() => handleTenantChange(tenant.id!)}
                  className={`
                    flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100
                    ${tenant.id === currentTenant ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}
                  `}
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">{tenant.name}</p>
                    {tenant.plan && (
                      <p className="text-xs text-gray-500">Piano: {tenant.plan}</p>
                    )}
                  </div>
                  {tenant.id === currentTenant && (
                    <svg
                      className="w-5 h-5 text-indigo-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};