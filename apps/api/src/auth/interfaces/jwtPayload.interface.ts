import { UserRole } from '../../users/entities/user.entity';

export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: TokenType;
}
