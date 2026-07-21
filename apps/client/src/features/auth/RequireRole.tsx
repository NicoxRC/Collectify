import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';

import type { UserRole } from '@/features/auth/authApi';

interface RequireRoleProps {
  allowedRoles: UserRole[];
}

// Nest inside ProtectedRoute to gate a specific route to one or more roles
// (e.g. message templates, user management). Not wired to any route yet in
// Phase 2 — there's nothing admin-only built so far — but the mechanism is
// ready for Phase 3+, per docs/phasesClient/PHASE_2_AUTH.md: don't rely on
// hiding a nav link alone, a collector must not reach the route by URL.
export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
