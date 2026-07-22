import { UserRole } from '../../users/entities/user.entity';

// fullName/createdAt added for the client's "Mi perfil" screen (client
// request) — both already existed on the User entity, just weren't
// surfaced via GET /auth/me. Purely additive: nothing consuming id/email/
// role changes.
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: Date;
}
