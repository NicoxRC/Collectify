import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { loansApi } from '@/features/loans/loansApi';

import type {
  LoansQueryParams,
  UpdateLoanInput,
} from '@/features/loans/loansApi';

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
