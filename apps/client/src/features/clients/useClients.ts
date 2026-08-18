import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clientsApi } from '@/features/clients/clientsApi';

import type {
  ClientsQueryParams,
  CreateClientReferenceInput,
  UpdateClientInput,
  UpdateClientReferenceInput,
} from '@/features/clients/clientsApi';

export function useClients(params: ClientsQueryParams) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => clientsApi.getAll(params),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.getOne(id),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClientInput }) =>
      clientsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useReactivateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientsApi.reactivate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// Phase 21 — references sub-resource. Each mutation invalidates
// ['clients', clientId] (the ClientDetail query, which is what carries
// `references`) rather than the whole ['clients'] list — the list view
// (Client, not ClientDetail) never shows references, so there's no need to
// refetch it here.
export function useAddClientReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clientId,
      input,
    }: {
      clientId: string;
      input: CreateClientReferenceInput;
    }) => clientsApi.addReference(clientId, input),
    onSuccess: (_data, { clientId }) =>
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] }),
  });
}

export function useUpdateClientReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clientId,
      referenceId,
      input,
    }: {
      clientId: string;
      referenceId: string;
      input: UpdateClientReferenceInput;
    }) => clientsApi.updateReference(clientId, referenceId, input),
    onSuccess: (_data, { clientId }) =>
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] }),
  });
}

export function useRemoveClientReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clientId,
      referenceId,
    }: {
      clientId: string;
      referenceId: string;
    }) => clientsApi.removeReference(clientId, referenceId),
    onSuccess: (_data, { clientId }) =>
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] }),
  });
}
