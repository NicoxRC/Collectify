import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { RequireRole } from '@/features/auth/RequireRole';
import { ClientDetailPage } from '@/features/clients/ClientDetailPage';
import { ClientsListPage } from '@/features/clients/ClientsListPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LoanDetailPage } from '@/features/loans/LoanDetailPage';
import { LoansListPage } from '@/features/loans/LoansListPage';
import { MessageLogsPage } from '@/features/messageLogs/MessageLogsPage';
import { MessageTemplatesPage } from '@/features/messageTemplates/MessageTemplatesPage';

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
            // Landing page after login for both roles — the backend has no
            // per-collector data scoping, so there's only one Dashboard, not
            // an admin/cobrador variant. Was HealthCheckPage (Phase 1
            // placeholder) until Phase 7. See DESIGN_TOKENS.md.
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'clientes',
            element: <ClientsListPage />,
          },
          {
            path: 'clientes/:id',
            element: <ClientDetailPage />,
          },
          {
            path: 'prestamos',
            element: <LoansListPage />,
          },
          {
            path: 'prestamos/:id',
            element: <LoanDetailPage />,
          },
          {
            path: 'mensajes',
            element: <MessageLogsPage />,
          },
          {
            // Not in the original 5-phase nav — reachable from the
            // Sidebar's user footer block, not a MENÚ item, matching the
            // client's "Mi perfil" design (no sidebar entry for it there
            // either).
            path: 'perfil',
            element: <ProfilePage />,
          },
          {
            // MessageTemplatesController is admin-only server-side (whole
            // controller, @Roles(UserRole.Admin)) — gated here too so a
            // collector can't reach it by typing the URL, not just by
            // hiding the nav link. See RequireRole.tsx.
            element: <RequireRole allowedRoles={['admin']} />,
            children: [
              {
                path: 'plantillas',
                element: <MessageTemplatesPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
