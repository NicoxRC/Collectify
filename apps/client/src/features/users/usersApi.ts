import { apiClient } from '@/lib/apiClient';

import type { UserRole } from '@/features/auth/authApi';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  collector: 'Cobrador',
};

// Matches apps/api/src/users/users.service.ts's PublicUser (User minus
// passwordHash) — the API never returns a password hash to the client.
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UsersQueryParams {
  // true (default) for active users, false for deactivated ones — same
  // convention as ClientsQueryParams/InterestConceptTypesQueryParams. No
  // search/pagination: QueryUsersDto only supports isActive, and a company
  // user list is expected to stay small.
  isActive?: boolean;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export const usersApi = {
  // Admin only — enforced server-side via @Roles(UserRole.Admin).
  getAll: async (params: UsersQueryParams = {}): Promise<User[]> => {
    const { data } = await apiClient.get<User[]>('/users', {
      isActive: params.isActive,
    });
    return data;
  },

  create: async (input: CreateUserInput): Promise<User> => {
    const { data } = await apiClient.post<User>('/users', input);
    return data;
  },

  // Locks the account out of login without deleting it — an admin cannot
  // deactivate their own account (enforced server-side).
  deactivate: async (id: string): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${id}/deactivate`);
    return data;
  },

  reactivate: async (id: string): Promise<User> => {
    const { data } = await apiClient.patch<User>(`/users/${id}/reactivate`);
    return data;
  },
};
