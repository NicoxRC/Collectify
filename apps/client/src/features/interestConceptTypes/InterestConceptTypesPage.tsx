import { useState } from 'react';

import { Header } from '@/components/layout/Header';
import { InterestConceptTypeForm } from '@/features/interestConceptTypes/InterestConceptTypeForm';
import { ConceptCalculationType } from '@/features/interestConceptTypes/interestConceptTypesApi';
import {
  useCreateInterestConceptType,
  useDeactivateInterestConceptType,
  useInterestConceptTypes,
  useUpdateInterestConceptType,
} from '@/features/interestConceptTypes/useInterestConceptTypes';

import type { InterestConceptType } from '@/features/interestConceptTypes/interestConceptTypesApi';

function formatDefaultValue(conceptType: InterestConceptType): string {
  if (conceptType.defaultValue == null) {
    return 'Sin valor por defecto';
  }
  return conceptType.defaultCalculationType ===
    ConceptCalculationType.Percentage
    ? `${conceptType.defaultValue}%`
    : `$${conceptType.defaultValue.toLocaleString('es-CO')}`;
}

// Admin screen for the catalog of interest/fee concept types introduced in
// Phase 14 — confirmed with the human that the admin must be able to add
// new kinds of concepts whenever needed, not pick from a fixed list. Loans
// pick from this catalog at creation time (LoanForm.tsx). Deactivating a
// type only removes it from that picker — loans that already used it keep
// the name/value they were generated with (snapshot), unaffected.
export function InterestConceptTypesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const {
    data: conceptTypes,
    isLoading,
    isError,
  } = useInterestConceptTypes({
    isActive: !showInactive,
  });

  const [formTarget, setFormTarget] = useState<
    InterestConceptType | 'new' | null
  >(null);

  const createConceptType = useCreateInterestConceptType();
  const updateConceptType = useUpdateInterestConceptType();
  const deactivateConceptType = useDeactivateInterestConceptType();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Header
          title="Conceptos de interés"
          subtitle="Solo ADMIN — catálogo usado al crear préstamos"
        />
        <button
          type="button"
          onClick={() => setFormTarget('new')}
          className="flex items-center gap-1.5 rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90"
        >
          {/* Matches the "+ Nuevo cliente"/"+ Nuevo préstamo" buttons —
              this one was missing the icon entirely. */}
          <svg
            className="size-3.5 shrink-0"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M10 4v12M4 10h12"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          Nuevo concepto
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowInactive(false)}
          className={`rounded px-3 py-1.5 text-small ${!showInactive ? 'bg-border text-white' : 'text-muted hover:text-white'}`}
        >
          Activos
        </button>
        <button
          type="button"
          onClick={() => setShowInactive(true)}
          className={`rounded px-3 py-1.5 text-small ${showInactive ? 'bg-border text-white' : 'text-muted hover:text-white'}`}
        >
          Desactivados
        </button>
      </div>

      {isLoading && <p className="text-small text-muted">Cargando…</p>}
      {isError && (
        <p className="text-small text-red-400" role="alert">
          No se pudieron cargar los conceptos.
        </p>
      )}
      {!isLoading && !isError && conceptTypes?.length === 0 && (
        <p className="text-small text-muted">
          {showInactive
            ? 'No hay conceptos desactivados.'
            : 'Todavía no hay conceptos de interés — crea el primero.'}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {conceptTypes?.map((conceptType) => (
          <div
            key={conceptType.id}
            className="flex items-center justify-between rounded bg-surface px-5 py-3.5"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-card-title font-medium text-white">
                {conceptType.name}
              </span>
              <span className="text-meta text-muted">
                {conceptType.defaultCalculationType ===
                ConceptCalculationType.Percentage
                  ? 'Porcentaje'
                  : 'Monto fijo'}{' '}
                · {formatDefaultValue(conceptType)}
              </span>
            </div>
            {!showInactive && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormTarget(conceptType)}
                  className="text-meta text-muted hover:text-white"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => deactivateConceptType.mutate(conceptType.id)}
                  className="text-meta text-muted hover:text-red-400"
                >
                  Desactivar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {formTarget && (
        <InterestConceptTypeForm
          conceptType={formTarget === 'new' ? undefined : formTarget}
          onSubmit={(input) =>
            formTarget === 'new'
              ? createConceptType.mutateAsync(input)
              : updateConceptType.mutateAsync({ id: formTarget.id, input })
          }
          onClose={() => setFormTarget(null)}
        />
      )}
    </div>
  );
}
