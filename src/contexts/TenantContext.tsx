import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useAuth } from './AuthContext';
import { type Tenant, type TenantUserRole, type TenantContextType } from '../types';

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: React.ReactNode;
}

const TENANT_STORAGE_KEY = 'selectedTenant';

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [currentTenant, setCurrentTenantState] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<Tenant | null>(null);
  const [userRole, setUserRole] = useState<TenantUserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { user, tenants } = useAuth();

  const loadInitialTenantForSuperAdmin = async () => {
    try {
      setLoading(true);
      const tenantId = 'default';

      // Set the tenant data directly for super admin
      setCurrentTenantState(tenantId);
      setTenantData({
        id: tenantId,
        name: 'Studio Legale IBLegal',
        plan: 'pro',
        active: true,
        createdAt: new Date() as any,
        createdBy: user?.uid || ''
      });
      setUserRole('admin');

      // Save to localStorage
      localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
    } catch (err) {
      console.error('Error loading super admin tenant:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Load saved tenant from localStorage on mount
  useEffect(() => {
    // Special case for super admin
    if (user?.email === 'daniele.miconi@iblegal.it') {
      // Super admin always gets access to default tenant
      loadInitialTenantForSuperAdmin();
      return;
    }

    if (!user || !tenants || tenants.length === 0) {
      setCurrentTenantState(null);
      setTenantData(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    const loadInitialTenant = async () => {
      try {
        // Check localStorage for saved tenant
        const savedTenant = localStorage.getItem(TENANT_STORAGE_KEY);

        let tenantToLoad: string | null = null;

        if (savedTenant && tenants.includes(savedTenant)) {
          // Use saved tenant if user still has access
          tenantToLoad = savedTenant;
        } else if (user.lastSelectedTenant && tenants.includes(user.lastSelectedTenant)) {
          // Fall back to last selected tenant from user profile
          tenantToLoad = user.lastSelectedTenant;
        } else if (user.defaultTenant && tenants.includes(user.defaultTenant)) {
          // Fall back to default tenant
          tenantToLoad = user.defaultTenant;
        } else if (tenants.length === 1) {
          // If user only has one tenant, auto-select it
          tenantToLoad = tenants[0];
        }

        if (tenantToLoad) {
          await loadTenantData(tenantToLoad);
        }
      } catch (err) {
        console.error('Error loading initial tenant:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialTenant();
  }, [user, tenants]);

  const loadTenantData = async (tenantId: string) => {
    if (!user || !tenants || !tenants.includes(tenantId)) {
      throw new Error('Invalid tenant or no access');
    }

    try {
      // Load tenant metadata
      const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
      if (!tenantDoc.exists()) {
        throw new Error('Tenant not found');
      }

      const tenant = { id: tenantId, ...tenantDoc.data() } as Tenant;

      // Load user's role in this tenant
      const userTenantDoc = await getDoc(
        doc(db, 'tenants', tenantId, 'users', user.uid!)
      );

      if (!userTenantDoc.exists()) {
        throw new Error('User not found in tenant');
      }

      const userTenantData = userTenantDoc.data();
      const role = userTenantData.role as TenantUserRole;

      setCurrentTenantState(tenantId);
      setTenantData(tenant);
      setUserRole(role);

      // Save to localStorage
      localStorage.setItem(TENANT_STORAGE_KEY, tenantId);

      // Update user's lastSelectedTenant in Firestore
      if (user.uid) {
        const userRef = doc(db, 'users', user.uid);
        await getDoc(userRef).then(async (userDoc) => {
          if (userDoc.exists()) {
            await import('firebase/firestore').then(({ updateDoc }) => {
              updateDoc(userRef, { lastSelectedTenant: tenantId });
            });
          }
        });
      }
    } catch (err) {
      console.error('Error loading tenant data:', err);
      throw err;
    }
  };

  const setCurrentTenant = async (tenantId: string) => {
    setError(null);
    setLoading(true);

    try {
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearCurrentTenant = () => {
    setCurrentTenantState(null);
    setTenantData(null);
    setUserRole(null);
    localStorage.removeItem(TENANT_STORAGE_KEY);
  };

  const value: TenantContextType = {
    currentTenant,
    tenantData,
    userRole,
    loading,
    error,
    setCurrentTenant,
    clearCurrentTenant,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};