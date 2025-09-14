import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { PrivateRoute } from './components/auth/PrivateRoute';
import { RequireTenant } from './components/tenant/RequireTenant';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { LegendPage } from './pages/LegendPage';
import { AdminPage } from './pages/AdminPage';
import { TrashPage } from './pages/TrashPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginForm />} />
              <Route path="/register" element={<RegisterForm />} />

              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <RequireTenant>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </RequireTenant>
                  </PrivateRoute>
                }
              />

              <Route
                path="/legend"
                element={
                  <PrivateRoute>
                    <RequireTenant>
                      <Layout>
                        <LegendPage />
                      </Layout>
                    </RequireTenant>
                  </PrivateRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <PrivateRoute requireAdmin>
                    <RequireTenant>
                      <Layout>
                        <AdminPage />
                      </Layout>
                    </RequireTenant>
                  </PrivateRoute>
                }
              />

              <Route
                path="/trash"
                element={
                  <PrivateRoute requireAdmin>
                    <RequireTenant>
                      <Layout>
                        <TrashPage />
                      </Layout>
                    </RequireTenant>
                  </PrivateRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;