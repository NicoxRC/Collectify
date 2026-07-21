import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { ClientDetailPage } from '@/features/clients/ClientDetailPage';
import { ClientsListPage } from '@/features/clients/ClientsListPage';
import { HealthCheckPage } from '@/features/health/HealthCheckPage';

// Grows with each phase: Phase 4+ add one route block per feature, nesting
// RequireRole where a route is admin-only. See docs/phasesClient.
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <HealthCheckPage />,
          },
          {
            path: 'clientes',
            element: <ClientsListPage />,
          },
          {
            path: 'clientes/:id',
            element: <ClientDetailPage />,
          },
        ],
      },
    ],
  },
]);
