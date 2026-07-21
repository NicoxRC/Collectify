import { apiClient } from '@/lib/apiClient';

import type {
  Installment,
  Payment,
} from '@/features/installments/installmentsApi';

// Matches apps/api/src/loans/entities/loan.entity.ts exactly.
export enum InstallmentFrequency {
  Monthly = 'monthly',
  Biweekly = 'biweekly',
}

export enum LoanStatus {
  Active = 'active',
  Paid = 'paid',
  Refinanced = 'refinanced',
}

export interface Loan {
  id: string;
  clientId: string;
  promissoryNoteNumber: string;
  principalAmount: number;
  interestRate: number;
  disbursedAt: string;
  installmentFrequency: InstallmentFrequency;
  totalInstallments: number;
  status: LoanStatus;
  refinancedFromLoanId: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// GET /loans (list) return shape — matches apps/api's LoanSummary. Added
// specifically for the standalone "Préstamos" screen (F-16/17), which is a
// different view from Clientes and needs to show whose loan it is plus
// collection status without opening it. clientFullName/outstandingBalance/
// installmentsPaid/overdueDays didn't exist on the API until this phase —
// LoansService.findAll now joins `client` and aggregates installments per
// loan to compute them. See DESIGN_TOKENS.md "Known design/backend gaps".
export interface LoanSummary extends Loan {
  clientFullName: string;
  outstandingBalance: number;
  installmentsPaid: number;
  overdueDays: number;
}

// GET /loans/:id return shape (apps/api's LoanDetail). Does NOT include
// clientFullName — only the list endpoint (LoanSummary) was extended with
// it, since the detail page is always reached with the client already
// known (from the list row or ClientDetailPage).
export interface LoanDetail extends Loan {
  installments: Installment[];
  // Computed reverse lookup: the loan this one was later refinanced into,
  // if any. Only relevant once Phase 6 (refinancing) ships.
  refinancedToLoanId: string | null;
}

export interface LoansQueryParams {
  clientId?: string;
  status?: LoanStatus;
  // Matches client name or promissory note number — added to
  // QueryLoansDto/LoansService.findAll for the Préstamos list's search box.
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedLoans {
  items: LoanSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Matches apps/api/src/loans/dto/createLoan.dto.ts exactly. No auto-split:
// installmentAmounts is one explicit amount per installment (order
// matters), and must sum to principalAmount or the API rejects with 400.
export interface CreateLoanInput {
  clientId: string;
  promissoryNoteNumber: string;
  principalAmount: number;
  interestRate: number;
  disbursedAt: string;
  installmentFrequency: InstallmentFrequency;
  installmentAmounts: number[];
  description?: string;
}

// Matches apps/api/src/loans/dto/updateLoan.dto.ts exactly — only these two
// fields are editable post-creation. principalAmount/schedule are NOT
// patchable (would cascade into already-generated installments, out of
// scope per the DTO's own comment).
export interface UpdateLoanInput {
  interestRate?: number;
  description?: string;
}

export const loansApi = {
  getAll: async (params: LoansQueryParams = {}): Promise<PaginatedLoans> => {
    const { data, meta } = await apiClient.get<LoanSummary[]>('/loans', {
      clientId: params.clientId,
      status: params.status,
      search: params.search,
      page: params.page,
      limit: params.limit,
    });
    return { items: data, meta: meta as PaginatedLoans['meta'] };
  },

  getOne: async (id: string): Promise<LoanDetail> => {
    const { data } = await apiClient.get<LoanDetail>(`/loans/${id}`);
    return data;
  },

  // Admin only — enforced server-side via @Roles(UserRole.Admin); the UI
  // still hides the action for non-admins, consistent with Clientes.
  create: async (input: CreateLoanInput): Promise<LoanDetail> => {
    const { data } = await apiClient.post<LoanDetail>('/loans', input);
    return data;
  },

  update: async (id: string, input: UpdateLoanInput): Promise<Loan> => {
    const { data } = await apiClient.patch<Loan>(`/loans/${id}`, input);
    return data;
  },

  // Added for the loan detail screen's "Historial de pagos" (F-19) — there
  // was previously no way to list a loan's payments at all on the backend,
  // only register one. See LoansService.getPayments.
  getPayments: async (id: string): Promise<Payment[]> => {
    const { data } = await apiClient.get<Payment[]>(`/loans/${id}/payments`);
    return data;
  },

  // Backs F-22 "Cambiar estado" — but only the "Pagado" transition is
  // real; "Al día"/"En mora" aren't stored states (see the gaps note in
  // DESIGN_TOKENS.md), so this is the one manual override that exists:
  // closing a loan out as paid without a per-installment payment trail
  // (e.g. the client paid in cash outside the system). Admin only.
  markAsPaid: async (id: string): Promise<LoanDetail> => {
    const { data } = await apiClient.post<LoanDetail>(
      `/loans/${id}/mark-as-paid`,
    );
    return data;
  },
};
