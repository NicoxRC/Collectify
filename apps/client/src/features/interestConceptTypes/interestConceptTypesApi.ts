import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/interestConceptTypes/entities/interestConceptType.entity.ts exactly.
export enum ConceptCalculationType {
  Percentage = 'percentage',
  FixedAmount = 'fixed_amount',
}

// Admin-managed catalog of interest/fee concepts (e.g. "Interés
// remuneratorio", "Gastos de cobranza") — confirmed with the client this
// must stay open-ended, not a fixed list. See
// docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
export interface InterestConceptType {
  id: string;
  name: string;
  defaultCalculationType: ConceptCalculationType;
  defaultValue: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface InterestConceptTypesQueryParams {
  // true (default) for active types, false for deactivated ones — same
  // convention as ClientsQueryParams/QueryUsersDto.
  isActive?: boolean;
}

export interface CreateInterestConceptTypeInput {
  name: string;
  defaultCalculationType: ConceptCalculationType;
  defaultValue?: number;
}

export type UpdateInterestConceptTypeInput =
  Partial<CreateInterestConceptTypeInput>;

export const interestConceptTypesApi = {
  // Admin only — enforced server-side via @Roles(UserRole.Admin).
  getAll: async (
    params: InterestConceptTypesQueryParams = {},
  ): Promise<InterestConceptType[]> => {
    const { data } = await apiClient.get<InterestConceptType[]>(
      '/interest-concept-types',
      { isActive: params.isActive },
    );
    return data;
  },

  create: async (
    input: CreateInterestConceptTypeInput,
  ): Promise<InterestConceptType> => {
    const { data } = await apiClient.post<InterestConceptType>(
      '/interest-concept-types',
      input,
    );
    return data;
  },

  update: async (
    id: string,
    input: UpdateInterestConceptTypeInput,
  ): Promise<InterestConceptType> => {
    const { data } = await apiClient.patch<InterestConceptType>(
      `/interest-concept-types/${id}`,
      input,
    );
    return data;
  },

  // Removes it from the picker for new loans — existing loans that already
  // used it keep their snapshotted values, unaffected.
  deactivate: async (id: string): Promise<InterestConceptType> => {
    const { data } = await apiClient.patch<InterestConceptType>(
      `/interest-concept-types/${id}/deactivate`,
    );
    return data;
  },
};
