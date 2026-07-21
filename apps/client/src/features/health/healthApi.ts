import { apiClient } from '@/lib/apiClient';

export interface HealthStatus {
  status: 'ok';
}

export const healthApi = {
  check: async (): Promise<HealthStatus> => {
    const { data } = await apiClient.get<HealthStatus>('/health');
    return data;
  },
};
