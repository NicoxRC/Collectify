import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../../users/entities/user.entity';
import { AppModule } from '../../users/entities/userModulePermission.entity';
import { MODULE_KEY } from '../decorators/requireModule.decorator';
import { AuthenticatedUser } from '../interfaces/authenticatedUser.interface';

// Phase 20 — runs alongside (not instead of) RolesGuard, both globally
// registered. No-ops (returns true) when a handler has no @RequireModule()
// metadata, so a controller still on the old @Roles() decorator is
// completely unaffected by this guard's existence — that's what makes the
// incremental, one-controller-at-a-time migration in
// docs/phases/PHASE_20_MODULE_PERMISSIONS.md safe. An admin always passes,
// regardless of @RequireModule — see UserModulePermission's doc comment.
@Injectable()
export class ModulePermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModule = this.reflector.getAllAndOverride<
      AppModule | undefined
    >(MODULE_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredModule) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    if (!user) {
      return false;
    }
    if (user.role === UserRole.Admin) {
      return true;
    }
    return user.modules.includes(requiredModule);
  }
}
