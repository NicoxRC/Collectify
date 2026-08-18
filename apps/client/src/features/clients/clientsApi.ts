import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/clients/entities/client.entity.ts's DocumentType
// exactly. Shared with Loan.coDebtorDocumentType (Phase 21) — a co-debtor
// is identified the same way a client is.
export enum DocumentType {
  CedulaCiudadania = 'cedula_ciudadania',
  CedulaExtranjeria = 'cedula_extranjeria',
  Pasaporte = 'pasaporte',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.CedulaCiudadania]: 'Cédula de ciudadanía',
  [DocumentType.CedulaExtranjeria]: 'Cédula de extranjería',
  [DocumentType.Pasaporte]: 'Pasaporte',
};

// Matches apps/api/src/clients/entities/clientReference.entity.ts exactly.
// A dynamic add-many list per client, no fixed min/max — see
// docs/phases/PHASE_21_CLIENT_PROFILE.md decision 2.
export enum ClientReferenceType {
  Personal = 'personal',
  Comercial = 'comercial',
}

export const CLIENT_REFERENCE_TYPE_LABELS: Record<ClientReferenceType, string> =
  {
    [ClientReferenceType.Personal]: 'Personal',
    [ClientReferenceType.Comercial]: 'Comercial',
  };

export interface ClientReference {
  id: string;
  clientId: string;
  type: ClientReferenceType;
  fullName: string;
  phoneNumber: string;
  relationship: string;
  createdAt: string;
  updatedAt: string;
}

// Matches apps/api/src/clients/dto/createClientReference.dto.ts /
// updateClientReference.dto.ts.
export interface CreateClientReferenceInput {
  type: ClientReferenceType;
  fullName: string;
  phoneNumber: string;
  relationship: string;
}

export type UpdateClientReferenceInput = Partial<CreateClientReferenceInput>;

// Matches apps/api/src/clients/entities/client.entity.ts exactly, including
// the Phase 21 extended profile fields. The Figma form (Phase 3) also
// showed "Correo electrónico" and "Dirección" that didn't exist on the
// entity at the time — both are now real (email, homeAddress), added by
// Phase 21, not the original Figma request. See apps/client/docs/
// DESIGN_TOKENS.md "Known design/backend gaps".
export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  phoneNumber: string;
  // Nullable — unset means no cupo enforced for this client. See
  // docs/phases/PHASE_10_CLIENT_CAPACITY.md.
  creditLimit: number | null;

  // --- Extended profile (KYC), Phase 21 — all nullable. See
  // docs/phases/PHASE_21_CLIENT_PROFILE.md for the confirmed field list. ---
  documentType: DocumentType | null;
  dateOfBirth: string | null;
  documentIssuePlace: string | null;
  email: string | null;
  alternatePhoneNumber: string | null;
  homeAddress: string | null;
  workAddress: string | null;
  neighborhood: string | null;
  city: string | null;
  occupation: string | null;
  employerName: string | null;
  monthlyIncome: number | null;
  idDocumentFrontUrl: string | null;
  idDocumentBackUrl: string | null;
  // Never required anywhere in this app — sensitive/biometric data under
  // Ley 1581 de 2012, see the Phase 21 legal summary. Always optional.
  selfieImageUrl: string | null;
  dataProcessingConsent: boolean;
  consentGivenAt: string | null;
  consentDocumentUrl: string | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// What GET /clients/:id returns — Client plus fields computed on read by
// ClientsService.findOneDetail, never stored, plus this client's
// references (Phase 21). GET /clients (list) returns plain Client rows
// without any of these, per the backend's findAll/findOneDetail split. See
// docs/phases/PHASE_10_CLIENT_CAPACITY.md.
export interface ClientDetail extends Client {
  creditUsed: number;
  creditAvailable: number | null;
  isMoraBlocked: boolean;
  references: ClientReference[];
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

// Matches apps/api/src/clients/dto/createClient.dto.ts exactly. Every
// Phase 21 field is optional at this type level — dataProcessingConsent is
// enforced as required by ClientForm.tsx's own validation (a checkbox that
// blocks submit), not by this type, since Excel-imported clients go
// through a different path that's deliberately exempt (decision 6).
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
  documentType?: DocumentType;
  dateOfBirth?: string;
  documentIssuePlace?: string;
  email?: string;
  alternatePhoneNumber?: string;
  homeAddress?: string;
  workAddress?: string;
  neighborhood?: string;
  city?: string;
  occupation?: string;
  employerName?: string;
  monthlyIncome?: number;
  idDocumentFrontUrl?: string;
  idDocumentBackUrl?: string;
  selfieImageUrl?: string;
  dataProcessingConsent?: boolean;
  consentDocumentUrl?: string;
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

  // Phase 21 — references sub-resource. Kept on this same api object
  // (rather than a separate clientReferencesApi) since every call is
  // always scoped to a clientId and there's no standalone references
  // screen — matches how e.g. loansApi.getPayments lives alongside loansApi
  // rather than in its own file.
  addReference: async (
    clientId: string,
    input: CreateClientReferenceInput,
  ): Promise<ClientReference> => {
    const { data } = await apiClient.post<ClientReference>(
      `/clients/${clientId}/references`,
      input,
    );
    return data;
  },

  updateReference: async (
    clientId: string,
    referenceId: string,
    input: UpdateClientReferenceInput,
  ): Promise<ClientReference> => {
    const { data } = await apiClient.patch<ClientReference>(
      `/clients/${clientId}/references/${referenceId}`,
      input,
    );
    return data;
  },

  removeReference: async (
    clientId: string,
    referenceId: string,
  ): Promise<void> => {
    await apiClient.delete(`/clients/${clientId}/references/${referenceId}`);
  },
};
