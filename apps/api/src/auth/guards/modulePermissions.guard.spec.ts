import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../../users/entities/user.entity';
import { AppModule } from '../../users/entities/userModulePermission.entity';
import { AuthenticatedUser } from '../interfaces/authenticatedUser.interface';
import { ModulePermissionsGuard } from './modulePermissions.guard';

describe('ModulePermissionsGuard', () => {
  let guard: ModulePermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const buildContext = (user?: AuthenticatedUser): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  const buildUser = (
    overrides: Partial<AuthenticatedUser> = {},
  ): AuthenticatedUser => ({
    id: 'user-1',
    email: 'a@b.com',
    fullName: 'Test User',
    role: UserRole.Collector,
    createdAt: new Date(),
    modules: [],
    ...overrides,
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new ModulePermissionsGuard(reflector as unknown as Reflector);
  });

  // Mandatory per docs/phases/PHASE_20_MODULE_PERMISSIONS.md — a controller
  // still on the old @Roles() decorator (no @RequireModule() metadata) must
  // be completely unaffected by this guard's existence, which is what makes
  // the one-controller-at-a-time migration safe.
  it('passes through untouched when the handler has no @RequireModule() metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext(buildUser({ modules: [] }));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(AppModule.MessageTemplates);
    const context = buildContext(undefined);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('always allows an admin, regardless of granted modules', () => {
    reflector.getAllAndOverride.mockReturnValue(AppModule.MessageTemplates);
    const context = buildContext(
      buildUser({ role: UserRole.Admin, modules: [] }),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a collector who has been granted the required module', () => {
    reflector.getAllAndOverride.mockReturnValue(AppModule.MessageTemplates);
    const context = buildContext(
      buildUser({ modules: [AppModule.MessageTemplates] }),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a collector who lacks the required module', () => {
    reflector.getAllAndOverride.mockReturnValue(AppModule.MessageTemplates);
    const context = buildContext(buildUser({ modules: [AppModule.Clients] }));

    expect(guard.canActivate(context)).toBe(false);
  });
});
