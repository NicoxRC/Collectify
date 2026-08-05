import { useEffect, useState } from 'react';

import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/format';
import { ImageUploadError, uploadPaymentReceipt } from '@/lib/imageUpload';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { Installment } from '@/features/installments/installmentsApi';
import type { ChangeEvent, FormEvent } from 'react';

interface RegisterPaymentDialogProps {
  // The installment this payment applies to. The API only accepts
  // payments per-installment (POST /installments/:id/payments) — there is
  // no loan-level "apply to whatever's next" endpoint, unlike what F-20's
  // simple "Préstamo #P-001 — Saldo: $800" header implies. The caller
  // decides which installment (see LoanDetailPage: the top "Registrar
  // pago" button targets the oldest pending one automatically, matching
  // Figma's no-picker flow; the cuotas table also offers a "Pagar" action
  // per row for when a specific installment needs to be targeted).
  installment: Installment;
  loanLabel: string;
  onClose: () => void;
  onConfirm: (input: {
    amountPaid: number;
    paidAt: string;
    observation?: string;
    imageUrl?: string;
  }) => Promise<unknown>;
}

// `new Date().toISOString().slice(0, 10)` (the obvious way to get
// "today") is wrong here: .toISOString() converts the current instant to
// UTC before formatting, which rolls the calendar date forward for any
// timezone behind UTC — e.g. America/Bogota (UTC-5) turns 21 jul 8:00pm
// local into 22 jul 1:00am UTC, showing tomorrow's date as the default.
// This reads the LOCAL calendar day directly instead (same bug class as
// formatDateOnly/dueDateMath.ts, opposite direction: those force UTC to
// stop the date from rolling BACK; this forces local to stop it rolling
// FORWARD).
function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Matched Figma F-20 "Registrar pago — Modal Desktop" exactly through
// Phase 4. Phase 12 (docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md)
// adds the receipt-photo file input below, which has no Figma frame at
// all — documented as a gap in DESIGN_TOKENS.md.
export function RegisterPaymentDialog({
  installment,
  loanLabel,
  onClose,
  onConfirm,
}: RegisterPaymentDialogProps) {
  // totalDue is amount + accrued interest (interestRate / 30 × overdueDays)
  // — that division routinely produces long repeating decimals (e.g.
  // 108333.3333333333). The business only ever deals in whole pesos
  // (formatCurrency's convention everywhere else in the app), so the
  // default shown here is rounded the same way rather than dumping the raw
  // float into the field. Still fully editable — this only affects the
  // pre-filled default.
  const [amountPaid, setAmountPaid] = useState(
    Math.round(installment.totalDue),
  );
  const [paidAt, setPaidAt] = useState(todayDateString());
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kept separate from the file itself: the file is uploaded to Cloudinary
  // BEFORE the payment is submitted (per
  // docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md), so by the time
  // handleSubmit runs, imageFile has already been turned into a URL here —
  // that's what actually gets sent to onConfirm.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEscapeKey(onClose);

  // object URLs must be revoked explicitly or they leak — this covers both
  // picking a new file (replacing the old preview) and unmounting the
  // dialog entirely.
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadError(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    setUploadError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const amount = amountPaid;
    if (!(amount > 0)) {
      setError('El monto del pago debe ser mayor a 0.');
      return;
    }
    if (!paidAt) {
      setError('La fecha de pago es obligatoria.');
      return;
    }

    // An upload failure must never let the payment submit silently without
    // the photo (docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md's
    // explicit requirement) — so this resolves imageUrl first, entirely
    // separate from isSubmitting, and bails out before touching onConfirm
    // if it fails.
    let imageUrl: string | undefined;
    if (imageFile) {
      setUploadError(null);
      setIsUploadingImage(true);
      try {
        imageUrl = await uploadPaymentReceipt(imageFile);
      } catch (err) {
        setUploadError(
          err instanceof ImageUploadError
            ? err.message
            : 'No se pudo subir la foto del comprobante. Intenta de nuevo.',
        );
        setIsUploadingImage(false);
        return;
      }
      setIsUploadingImage(false);
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        amountPaid: amount,
        paidAt,
        observation: observation.trim() || undefined,
        imageUrl,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo registrar el pago. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-lg border border-border bg-surface px-8 py-7">
        <h2 className="text-[16px] font-medium text-white">Registrar pago</h2>
        <p className="mt-1 text-label text-muted">
          {loanLabel} — Cuota {installment.installmentNumber} · Saldo{' '}
          {formatCurrency(installment.totalDue)}
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <div className="flex gap-4">
            <Field label="Monto del pago">
              <CurrencyInput
                value={amountPaid}
                onChange={setAmountPaid}
                className={inputClassName}
              />
            </Field>
            <Field label="Fecha de pago">
              <DatePicker
                value={paidAt}
                onChange={setPaidAt}
                className={inputClassName}
              />
            </Field>
          </div>

          <Field label="Observación (opcional)">
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Ej: pago recibido en efectivo"
              rows={3}
              // Not inputClassName — that has a fixed h-[42px] meant for
              // single-line inputs, which fights with rows={3} and squeezes
              // the text with no vertical padding. py-2.5 instead lets the
              // textarea size itself naturally.
              className="w-full resize-none rounded border border-border bg-input px-3.5 py-2 text-control text-white placeholder-mid focus:border-subtle focus:outline-none"
            />
          </Field>

          <Field label="Foto del comprobante (opcional)">
            {imagePreviewUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={imagePreviewUrl}
                  alt="Vista previa del comprobante"
                  className="h-[42px] w-[42px] rounded border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-meta text-subtle hover:text-white"
                >
                  Quitar foto
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-control text-muted file:mr-3 file:rounded file:border file:border-border file:bg-input file:px-3 file:py-1.5 file:text-meta file:text-muted hover:file:text-white"
              />
            )}
            {uploadError && (
              <p className="text-small text-red-400" role="alert">
                {uploadError}
              </p>
            )}
          </Field>

          {error && (
            <p className="text-small text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="mt-2.5 border-t border-border" />

          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImage}
              className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingImage
                ? 'Subiendo foto…'
                : isSubmitting
                  ? 'Registrando…'
                  : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClassName =
  'h-[42px] w-full rounded border border-border bg-input px-3.5 text-control text-white placeholder-mid focus:border-subtle focus:outline-none';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="text-[10px] font-medium tracking-[0.4px] text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
