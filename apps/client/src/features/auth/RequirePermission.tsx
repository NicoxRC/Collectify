import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';

import type { AppModule } from '@/features/auth/authApi';

interface RequirePermissionProps {
  module: AppModule;
}

// Phase 20 — sits alongside RequireRole.tsx, not a replacement for it: only
// routes whose backend controller has migrated to @RequireModule() (see
// docs/phases/PHASE_20_MODULE_PERMISSIONS.md) use this. An admin always
// passes, matching ModulePermissionsGuard server-side — mirroring the same
// check client- and server-side keeps them from ever drifting apart for a
// given module.
export function RequirePermission({ module }: RequirePermissionProps) {
  const { user } = useAuth();

  if (!user || (user.role !== 'admin' && !user.modules.includes(module))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
