import { UserRole } from '../../users/entities/user.entity';

import type { AppModule } from '../../users/entities/userModulePermission.entity';

// fullName/createdAt added for the client's "Mi perfil" screen (client
// request) — both already existed on the User entity, just weren't
// surfaced via GET /auth/me. Purely additive: nothing consuming id/email/
// role changes.
//
// modules added Phase 20 — the collector's granted module permissions,
// fetched fresh on every request (JwtStrategy already does a DB round trip
// per request, see JwtStrategy.validate) so a permission change takes
// effect on the very next request, not after a token refresh. Always []
// for an admin: the permission rows are never even queried for one, since
// an admin has full access unconditionally regardless of this field. See
// docs/phases/PHASE_20_MODULE_PERMISSIONS.md.
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: Date;
  modules: AppModule[];
}
