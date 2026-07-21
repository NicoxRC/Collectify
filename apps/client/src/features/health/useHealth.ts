import { useQuery } from '@tanstack/react-query';

import { healthApi } from '@/features/health/healthApi';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: healthApi.check,
  });
}
