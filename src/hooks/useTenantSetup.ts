import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

export enum TenantSetupState {
  LOADING = 'loading',
  NO_TENANTS = 'no_tenants',
  SINGLE_TENANT = 'single_tenant',
  MULTIPLE_TENANTS = 'multiple_tenants',
  TENANT_SELECTED = 'tenant_selected',
  ERROR = 'error'
}

interface UseTenantSetupReturn {
  state: TenantSetupState;
  tenants: string[] | null;
  needsSelection: boolean;
  error: Error | null;
}

export const useTenantSetup = (): UseTenantSetupReturn => {
  const { user, tenants, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading, error: tenantError } = useTenant();
  const [state, setState] = useState<TenantSetupState>(TenantSetupState.LOADING);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Still loading
    if (authLoading || tenantLoading) {
      setState(TenantSetupState.LOADING);
      return;
    }

    // No user logged in
    if (!user) {
      setState(TenantSetupState.LOADING);
      return;
    }

    // Special case for super admin - always has access
    if (user.email === 'daniele.miconi@iblegal.it') {
      if (currentTenant) {
        setState(TenantSetupState.TENANT_SELECTED);
      } else {
        setState(TenantSetupState.SINGLE_TENANT);
      }
      return;
    }

    // User has no tenants
    if (!tenants || tenants.length === 0) {
      setState(TenantSetupState.NO_TENANTS);
      setError(new Error('Non hai accesso a nessuno studio legale. Contatta un amministratore per ottenere l\'autorizzazione.'));
      return;
    }

    // User has single tenant
    if (tenants.length === 1) {
      if (currentTenant) {
        setState(TenantSetupState.TENANT_SELECTED);
      } else {
        setState(TenantSetupState.SINGLE_TENANT);
      }
      return;
    }

    // User has multiple tenants
    if (tenants.length > 1) {
      if (currentTenant) {
        setState(TenantSetupState.TENANT_SELECTED);
      } else {
        setState(TenantSetupState.MULTIPLE_TENANTS);
      }
      return;
    }

    // Handle any tenant errors
    if (tenantError) {
      setState(TenantSetupState.ERROR);
      setError(tenantError);
    }
  }, [user, tenants, authLoading, tenantLoading, currentTenant, tenantError]);

  const needsSelection = state === TenantSetupState.MULTIPLE_TENANTS;

  return {
    state,
    tenants,
    needsSelection,
    error
  };
};