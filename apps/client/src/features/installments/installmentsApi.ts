import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/loans/entities/installment.entity.ts exactly.
export enum InstallmentStatus {
  Pending = 'pending',
  Paid = 'paid',
  Cancelled = 'cancelled',
}

// Matches apps/api/src/loans/installments/enrichInstallment.ts's
// InstallmentWithCalculated exactly. overdueDays/interest/totalDue are
// calculated on read by the API, NEVER on the client — Phase 4's explicit
// rule (docs/phasesClient/PHASE_4_LOANS_INSTALLMENTS.md). They come back as
// 0 for any non-pending installment (paid or cancelled), per the API's own
// enrichInstallment logic — not a special case to handle here.
// principalPortion/conceptBreakdown were added in Phase 14 — both were
// computed once at schedule-generation time and are read back as stored,
// unlike overdueDays/interest/totalDue. principalPortion is null for
// installments generated before Phase 14 shipped.
export interface Installment {
  id: string;
  loanId: string;
  installmentNumber: number;
  amount: number;
  principalPortion: number | null;
  dueDate: string;
  status: InstallmentStatus;
  isInitial: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  overdueDays: number;
  interest: number;
  totalDue: number;
  conceptBreakdown: { name: string; amount: number }[];
}

export interface InstallmentsQueryParams {
  loanId?: string;
  status?: InstallmentStatus;
  // Only pending installments past their due date — server-side filter,
  // not derived client-side.
  overdueOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedInstallments {
  items: Installment[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Matches apps/api/src/loans/installments/dto/createPayment.dto.ts exactly.
// imageUrl (Phase 12) is the already-hosted receipt photo URL — the api
// only stores it, it never receives the file itself. See
// lib/imageUpload.ts for how that URL is obtained before this is called.
export interface CreatePaymentInput {
  amountPaid: number;
  paidAt: string;
  observation?: string;
  imageUrl?: string;
}

// Matches apps/api/src/loans/entities/payment.entity.ts. Note: registering
// a payment returns only this raw Payment row — NOT the updated
// installment or loan. The caller (useRegisterPayment) must invalidate the
// loan-detail query itself to see the installment's new status reflected.
export interface Payment {
  id: string;
  installmentId: string;
  amountPaid: number;
  paidAt: string;
  observation: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const installmentsApi = {
  getAll: async (
    params: InstallmentsQueryParams = {},
  ): Promise<PaginatedInstallments> => {
    const { data, meta } = await apiClient.get<Installment[]>('/installments', {
      loanId: params.loanId,
      status: params.status,
      overdueOnly: params.overdueOnly,
      page: params.page,
      limit: params.limit,
    });
    return { items: data, meta: meta as PaginatedInstallments['meta'] };
  },

  registerPayment: async (
    installmentId: string,
    input: CreatePaymentInput,
  ): Promise<Payment> => {
    const { data } = await apiClient.post<Payment>(
      `/installments/${installmentId}/payments`,
      input,
    );
    return data;
  },
};
