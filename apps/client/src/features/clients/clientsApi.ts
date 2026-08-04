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
  // Nullable — unset means no cupo enforced for this client. See
  // docs/phases/PHASE_10_CLIENT_CAPACITY.md.
  creditLimit: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// What GET /clients/:id returns — Client plus fields computed on read by
// ClientsService.findOneDetail, never stored. GET /clients (list) returns
// plain Client rows without these, per the backend's findAll/findOneDetail
// split. See docs/phases/PHASE_10_CLIENT_CAPACITY.md.
export interface ClientDetail extends Client {
  creditUsed: number;
  creditAvailable: number | null;
  isMoraBlocked: boolean;
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
  // Omitted (not 0/null) means no cupo enforced — see CreateClientDto's
  // @IsOptional() @IsPositive(). There is currently no way to explicitly
  // clear a previously-set cupo via PATCH; see DESIGN_TOKENS.md "Known
  // design/backend gaps".
  creditLimit?: number;
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

  getOne: async (id: string): Promise<ClientDetail> => {
    const { data } = await apiClient.get<ClientDetail>(`/clients/${id}`);
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

  // Soft-deletes the client (this is what "Desactivar" does).
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/clients/${id}`);
  },

  // Restores a soft-deleted client. Admin only — see
  // docs/phases/PHASE_10_CLIENT_CAPACITY.md.
  reactivate: async (id: string): Promise<Client> => {
    const { data } = await apiClient.patch<Client>(`/clients/${id}/reactivate`);
    return data;
  },
};
