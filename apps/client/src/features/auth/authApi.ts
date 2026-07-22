import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/users/entities/user.entity.ts UserRole enum.
export type UserRole = 'admin' | 'collector';

// Matches apps/api/src/auth/interfaces/authenticatedUser.interface.ts.
// fullName/createdAt added for the "Mi perfil" screen (client request,
// post-Phase-5) — both already existed on the User entity, GET /auth/me
// just didn't surface them yet. See apps/client/docs/DESIGN_TOKENS.md
// "Known design/backend gaps".
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: async (input: LoginInput): Promise<AuthTokens> => {
    const { data } = await apiClient.post<AuthTokens>('/auth/login', input);
    return data;
  },

  refresh: async (
    refreshToken: string,
  ): Promise<Pick<AuthTokens, 'accessToken'>> => {
    const { data } = await apiClient.post<Pick<AuthTokens, 'accessToken'>>(
      '/auth/refresh',
      { refreshToken },
    );
    return data;
  },

  me: async (): Promise<AuthenticatedUser> => {
    const { data } = await apiClient.get<AuthenticatedUser>('/auth/me');
    return data;
  },

  changePassword: async (input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await apiClient.post('/auth/change-password', input);
  },
};
