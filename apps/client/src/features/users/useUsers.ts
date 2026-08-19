import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi } from '@/features/users/usersApi';

import type { UsersQueryParams } from '@/features/users/usersApi';

export function useUsers(params: UsersQueryParams = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.getAll(params),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.reactivate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
