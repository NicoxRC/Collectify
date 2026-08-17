import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usuryRatesApi } from '@/features/usuryRates/usuryRatesApi';

// Shared by the settings page and the stale-rate banner (LoansListPage,
// LoanForm) — a single query key means entering a new month's rate from
// the settings page instantly clears the banner everywhere else too.
export function useCurrentUsuryRate() {
  return useQuery({
    queryKey: ['usuryRates', 'current'],
    queryFn: usuryRatesApi.getCurrent,
  });
}

export function useUsuryRateHistory() {
  return useQuery({
    queryKey: ['usuryRates', 'history'],
    queryFn: usuryRatesApi.getHistory,
  });
}

export function useSetUsuryRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usuryRatesApi.setRate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['usuryRates'] }),
  });
}
