import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { AuditLogsPage } from '@/features/auditLogs/AuditLogsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { RequireRole } from '@/features/auth/RequireRole';
import { ClientDetailPage } from '@/features/clients/ClientDetailPage';
import { ClientsListPage } from '@/features/clients/ClientsListPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { InterestConceptTypesPage } from '@/features/interestConceptTypes/InterestConceptTypesPage';
import { LoanDetailPage } from '@/features/loans/LoanDetailPage';
import { LoansListPage } from '@/features/loans/LoansListPage';
import { MessageLogsPage } from '@/features/messageLogs/MessageLogsPage';
import { MessageTemplatesPage } from '@/features/messageTemplates/MessageTemplatesPage';
import { UsersListPage } from '@/features/users/UsersListPage';
import { UsuryRatesPage } from '@/features/usuryRates/UsuryRatesPage';

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
            // MessageTemplatesController migrated to Phase 20's module
            // permissions (@RequireModule(AppModule.MessageTemplates)) —
            // gated here the same way, not by role, so client and server
            // never drift apart for this one module. See
            // RequirePermission.tsx and
            // docs/phases/PHASE_20_MODULE_PERMISSIONS.md.
            element: <RequirePermission module="message_templates" />,
            children: [
              {
                path: 'plantillas',
                element: <MessageTemplatesPage />,
              },
            ],
          },
          {
            // Every controller below is still admin-only server-side via
            // the older @Roles(UserRole.Admin) — gated here too so a
            // collector can't reach it by typing the URL, not just by
            // hiding the nav link. See RequireRole.tsx. Migrated to
            // RequirePermission one at a time, alongside its backend
            // controller — see docs/phases/PHASE_20_MODULE_PERMISSIONS.md.
            element: <RequireRole allowedRoles={['admin']} />,
            children: [
              {
                // InterestConceptTypesController is admin-only server-side
                // (@Roles(UserRole.Admin)) — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
                path: 'conceptos-de-interes',
                element: <InterestConceptTypesPage />,
              },
              {
                path: 'auditoria',
                element: <AuditLogsPage />,
              },
              {
                // UsuryRatesController is admin-only server-side
                // (@Roles(UserRole.Admin)) — see
                // docs/phases/PHASE_15_USURY_RATE.md.
                path: 'tasa-de-usura',
                element: <UsuryRatesPage />,
              },
              {
                // UsersController is admin-only server-side
                // (@Roles(UserRole.Admin)) — see
                // docs/phasesClient/PHASE_19_USER_MANAGEMENT.md.
                path: 'usuarios',
                element: <UsersListPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
