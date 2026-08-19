import { SetMetadata } from '@nestjs/common';

import { AppModule } from '../../users/entities/userModulePermission.entity';

export const MODULE_KEY = 'module';

// Phase 20 — replaces @Roles(UserRole.Admin) on a controller/handler that's
// migrating to per-user module permissions (see
// docs/phases/PHASE_20_MODULE_PERMISSIONS.md). Migrated incrementally, one
// controller at a time — an un-migrated controller keeps its existing
// @Roles() decorator untouched and is unaffected by ModulePermissionsGuard,
// which no-ops when this metadata is absent.
export const RequireModule = (module: AppModule) =>
  SetMetadata(MODULE_KEY, module);
