import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/usuryRates/entities/usuryRate.entity.ts. Historical,
// append-only rows — see docs/phases/PHASE_15_USURY_RATE.md.
export interface UsuryRate {
  id: string;
  effectiveMonth: string;
  ratePercentage: number;
  createdBy: string | null;
  createdAt: string;
}

export interface CurrentUsuryRate extends UsuryRate {
  // True when nobody has entered this calendar month's certified rate yet
  // — not tied to a fixed publication day, since the SFC's own publication
  // date moves around. Keep showing an alert every session until a
  // current-month rate is entered (confirmed with the client).
  isStale: boolean;
}

export interface CreateUsuryRateInput {
  effectiveMonth: string;
  ratePercentage: number;
}

export const usuryRatesApi = {
  // Admin only — enforced server-side via @Roles(UserRole.Admin). Returns
  // null when no rate has ever been entered.
  getCurrent: async (): Promise<CurrentUsuryRate | null> => {
    const { data } = await apiClient.get<CurrentUsuryRate | null>(
      '/usury-rates/current',
    );
    return data;
  },

  getHistory: async (): Promise<UsuryRate[]> => {
    const { data } = await apiClient.get<UsuryRate[]>('/usury-rates');
    return data;
  },

  setRate: async (input: CreateUsuryRateInput): Promise<UsuryRate> => {
    const { data } = await apiClient.post<UsuryRate>('/usury-rates', input);
    return data;
  },
};
