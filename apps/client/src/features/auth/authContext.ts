import { createContext } from 'react';

import type { AuthenticatedUser, LoginInput } from '@/features/auth/authApi';

export interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  // True until the initial silent-refresh attempt resolves — route guards
  // should show a loading state instead of redirecting to /login while
  // this is true. See features/auth/AuthContext.tsx.
  isBootstrapping: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
