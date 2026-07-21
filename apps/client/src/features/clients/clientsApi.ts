import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/clients/entities/client.entity.ts exactly. The
// Figma form also shows "Correo electrónico" and "Dirección" — neither
// exists on this entity, so they're not modeled here. See
// apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps".
export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ClientsQueryParams {
  search?: string;
  // true = active (default), false = soft-deleted, 'all' = both — the
  // backend originally only supported a strict boolean; 'all' was added to
  // ClientsService.findAll/QueryClientsDto specifically to back the "Todos"
  // tab (see ClientsListPage.tsx).
  isActive?: boolean | 'all';
  page?: number;
  limit?: number;
}

export interface PaginatedClients {
  items: Client[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Matches apps/api/src/clients/dto/createClient.dto.ts exactly — no email,
// address, or status field (none exist on the entity or the DTO).
export interface CreateClientInput {
  firstName: string;
  lastName: string;
  documentNumber: string;
  phoneNumber: string;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export const clientsApi = {
  getAll: async (
    params: ClientsQueryParams = {},
  ): Promise<PaginatedClients> => {
    const { data, meta } = await apiClient.get<Client[]>('/clients', {
      search: params.search,
      isActive: params.isActive,
      page: params.page,
      limit: params.limit,
    });
    return { items: data, meta: meta as PaginatedClients['meta'] };
  },

  getOne: async (id: string): Promise<Client> => {
    const { data } = await apiClient.get<Client>(`/clients/${id}`);
    return data;
  },

  create: async (input: CreateClientInput): Promise<Client> => {
    const { data } = await apiClient.post<Client>('/clients', input);
    return data;
  },

  update: async (id: string, input: UpdateClientInput): Promise<Client> => {
    const { data } = await apiClient.patch<Client>(`/clients/${id}`, input);
    return data;
  },

  // Soft-deletes the client (this is what "Desactivar" does — there is no
  // "reactivate" endpoint on the backend yet, see the gaps note above).
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/clients/${id}`);
  },
};
