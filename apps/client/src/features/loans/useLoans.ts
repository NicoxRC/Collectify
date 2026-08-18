import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { loansApi } from '@/features/loans/loansApi';

import type {
  LoansQueryParams,
  RefinanceLoanInput,
  UpdateLoanInput,
} from '@/features/loans/loansApi';

// Not a useQuery — the admin triggers this on demand (a "Previsualizar
// cronograma" button), not automatically on every keystroke, so a mutation
// (imperative .mutateAsync call) fits better than a cached, key-driven query.
export function usePreviewSchedule() {
  return useMutation({ mutationFn: loansApi.previewSchedule });
}

export function useLoans(params: LoansQueryParams) {
  return useQuery({
    queryKey: ['loans', params],
    queryFn: () => loansApi.getAll(params),
  });
}

export function useLoan(id: string) {
  return useQuery({
    queryKey: ['loans', id],
    queryFn: () => loansApi.getOne(id),
    enabled: Boolean(id),
  });
}

export function useLoanPayments(id: string) {
  return useQuery({
    queryKey: ['loans', id, 'payments'],
    queryFn: () => loansApi.getPayments(id),
    enabled: Boolean(id),
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loansApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLoanInput }) =>
      loansApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  });
}

export function useMarkLoanAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loansApi.markAsPaid,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  });
}

// Not a useQuery — fetched on demand when the "Liquidar anticipadamente"
// dialog opens (via .mutateAsync), same pattern as usePreviewSchedule.
export function usePayoffQuote() {
  return useMutation({ mutationFn: loansApi.getPayoffQuote });
}

export function usePayoffLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loansApi.payoff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  });
}

export function useRefinanceLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RefinanceLoanInput }) =>
      loansApi.refinance(id, input),
    // Invalidates every loan query — this mutates two loans at once (old
    // loan's status/installments, new loan created), so a targeted
    // invalidation isn't worth the complexity.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  });
}
