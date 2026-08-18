import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { FileUploadField } from '@/components/ui/FileUploadField';
import { Select } from '@/components/ui/Select';
import {
  ClientReferenceType,
  CLIENT_REFERENCE_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  DocumentType,
} from '@/features/clients/clientsApi';
import {
  useAddClientReference,
  useClient,
  useRemoveClientReference,
  useUpdateClientReference,
} from '@/features/clients/useClients';
import { ApiError } from '@/lib/apiClient';
import { ImageUploadError, uploadDocument } from '@/lib/imageUpload';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type {
  Client,
  ClientReference,
  CreateClientInput,
} from '@/features/clients/clientsApi';
import type { FormEvent } from 'react';

interface ClientFormProps {
  // Present = editing; absent = creating. Matches the two Figma modals
  // (F-11 "Nuevo cliente" / F-12 "Editar cliente"), same layout for both.
  // Only a plain Client is required here (ClientsListPage's edit action
  // only has that, not ClientDetail) — this form fetches the full detail
  // itself below, just for the references list.
  client?: Client;
  onSubmit: (input: CreateClientInput) => Promise<Client>;
  onClose: () => void;
}

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'documentNumber'
  | 'phoneNumber'
  | 'dataProcessingConsent'
  | 'references';
type FieldErrors = Partial<Record<FieldName, string>>;

// Mirrors apps/api's CreateClientDto: @IsPhoneNumber('CO') requires a
// Colombian number. This is a client-side approximation (the backend, via
// libphonenumber-js, is the real authority) — good enough to catch the
// obvious mistake of typing a bare local number without +57.
const CO_PHONE_REGEX = /^\+57\d{10}$/;

const DOCUMENT_TYPE_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  ...Object.values(DocumentType).map((type) => ({
    value: type,
    label: DOCUMENT_TYPE_LABELS[type],
  })),
];

// One row of the "Referencias" repeater. `id` is present only for a
// reference that already exists on the server (editing an existing
// client) — its absence is exactly what tells syncReferences below
// whether a row needs POST (new) or PATCH (changed) on submit. `rowId` is
// a client-only key for React identity / stable row order as rows are
// added and removed, same pattern as LoanForm.tsx's ConceptRow.rowId.
interface ReferenceRow {
  rowId: string;
  id?: string;
  type: ClientReferenceType;
  fullName: string;
  phoneNumber: string;
  relationship: string;
}

let nextRowId = 0;
function makeRowId(): string {
  nextRowId += 1;
  return `reference-row-${nextRowId}`;
}

function referenceToRow(reference: ClientReference): ReferenceRow {
  return {
    rowId: makeRowId(),
    id: reference.id,
    type: reference.type,
    fullName: reference.fullName,
    phoneNumber: reference.phoneNumber,
    relationship: reference.relationship,
  };
}

// Phase 3 fields (firstName, lastName, documentNumber, phoneNumber,
// creditLimit) plus the full Phase 21 extended-profile field set — see
// docs/phases/PHASE_21_CLIENT_PROFILE.md for the confirmed list and the
// reasoning behind each decision. Sectioned ("Datos personales",
// "Contacto", "Direcciones", "Referencias", "Documentos", "Autorización")
// per docs/phasesClient/PHASE_21_CLIENT_PROFILE.md, rather than one flat
// list of fields — the form got too long for that once Phase 21 landed.
export function ClientForm({ client, onSubmit, onClose }: ClientFormProps) {
  const isEditing = Boolean(client);

  // Only fetched for its `references` — every other field below is
  // pre-filled straight from the `client` prop, which already carries the
  // full Phase 21 column set (GET /clients returns plain Client rows, not
  // a reduced shape). ClientDetailPage already has this exact query
  // cached (same key), so this is effectively free there; ClientsListPage
  // triggers a real fetch, since its own list view never has references.
  const { data: clientDetail } = useClient(client?.id ?? '');
  const addReference = useAddClientReference();
  const updateReference = useUpdateClientReference();
  const removeReference = useRemoveClientReference();

  const [firstName, setFirstName] = useState(client?.firstName ?? '');
  const [lastName, setLastName] = useState(client?.lastName ?? '');
  const [documentNumber, setDocumentNumber] = useState(
    client?.documentNumber ?? '',
  );
  const [documentType, setDocumentType] = useState(client?.documentType ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(client?.dateOfBirth ?? '');
  const [documentIssuePlace, setDocumentIssuePlace] = useState(
    client?.documentIssuePlace ?? '',
  );
  const [occupation, setOccupation] = useState(client?.occupation ?? '');
  const [employerName, setEmployerName] = useState(client?.employerName ?? '');
  const [monthlyIncome, setMonthlyIncome] = useState(
    client?.monthlyIncome ?? 0,
  );
  // 0 means "no cupo set" per CurrencyInput's own empty-value convention —
  // matches creditLimit being omitted/undefined on submit below. See
  // docs/phases/PHASE_10_CLIENT_CAPACITY.md.
  const [creditLimit, setCreditLimit] = useState(client?.creditLimit ?? 0);

  const [phoneNumber, setPhoneNumber] = useState(client?.phoneNumber ?? '');
  const [alternatePhoneNumber, setAlternatePhoneNumber] = useState(
    client?.alternatePhoneNumber ?? '',
  );
  const [email, setEmail] = useState(client?.email ?? '');

  const [homeAddress, setHomeAddress] = useState(client?.homeAddress ?? '');
  const [workAddress, setWorkAddress] = useState(client?.workAddress ?? '');
  const [neighborhood, setNeighborhood] = useState(client?.neighborhood ?? '');
  const [city, setCity] = useState(client?.city ?? '');

  const [referenceRows, setReferenceRows] = useState<ReferenceRow[]>(
    () => clientDetail?.references.map(referenceToRow) ?? [],
  );
  // Tracks whether referenceRows was ever initialized from a loaded
  // clientDetail — without this, the useState initializer above only runs
  // once on mount, before the useClient fetch resolves, so an editing
  // client's existing references would silently start out empty. Simpler
  // than a useEffect + loading branch for what's otherwise a one-time
  // hydration.
  const [referencesHydrated, setReferencesHydrated] = useState(
    Boolean(clientDetail),
  );
  if (clientDetail && !referencesHydrated) {
    setReferenceRows(clientDetail.references.map(referenceToRow));
    setReferencesHydrated(true);
  }

  const [idDocumentFrontFile, setIdDocumentFrontFile] = useState<File | null>(
    null,
  );
  const [idDocumentBackFile, setIdDocumentBackFile] = useState<File | null>(
    null,
  );
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [consentDocumentFile, setConsentDocumentFile] = useState<File | null>(
    null,
  );

  // Required, form-level — see docs/phasesClient/PHASE_21_CLIENT_PROFILE.md:
  // "a required checkbox... that must be checked before the form can be
  // submitted". The backend only enforces this on the interactive create
  // path (Excel imports are exempt, ClientsService.create's
  // requireConsent option) — this form applies the same rule to editing
  // too, as a safety net, since ImportClientsDialog.tsx never uses this
  // form at all and is unaffected either way.
  const [dataProcessingConsent, setDataProcessingConsent] = useState(
    client?.dataProcessingConsent ?? false,
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEscapeKey(onClose);

  const addReferenceRow = () => {
    setReferenceRows((prev) => [
      ...prev,
      {
        rowId: makeRowId(),
        type: ClientReferenceType.Personal,
        fullName: '',
        phoneNumber: '',
        relationship: '',
      },
    ]);
    setFieldErrors((prev) => ({ ...prev, references: undefined }));
  };

  const updateReferenceRow = (
    rowId: string,
    changes: Partial<ReferenceRow>,
  ) => {
    setReferenceRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...changes } : row)),
    );
    setFieldErrors((prev) => ({ ...prev, references: undefined }));
  };

  const removeReferenceRow = (rowId: string) => {
    setReferenceRows((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  // Mirrors CreateClientDto's validators client-side, so obvious mistakes
  // are caught before hitting the API — required by Phase 3 scope, plus
  // the Phase 21 consent checkbox and reference row completeness.
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!firstName.trim()) {
      errors.firstName = 'El nombre es obligatorio.';
    }
    if (!lastName.trim()) {
      errors.lastName = 'El apellido es obligatorio.';
    }
    if (!documentNumber.trim()) {
      errors.documentNumber = 'La cédula es obligatoria.';
    }
    if (!phoneNumber.trim()) {
      errors.phoneNumber = 'El celular es obligatorio.';
    } else if (!CO_PHONE_REGEX.test(phoneNumber.trim())) {
      errors.phoneNumber =
        'Debe ser un número colombiano válido, ej: +573001234567.';
    }
    if (!dataProcessingConsent) {
      errors.dataProcessingConsent =
        'El cliente debe autorizar el tratamiento de datos personales antes de guardar.';
    }
    if (
      referenceRows.some(
        (row) =>
          !row.fullName.trim() ||
          !row.phoneNumber.trim() ||
          !row.relationship.trim(),
      )
    ) {
      errors.references =
        'Completa nombre, teléfono y relación de cada referencia agregada, o quítala.';
    }

    return errors;
  };

  // Uploads whichever of the four optional files were picked, in
  // parallel — independent uploads, no reason to serialize them. Returns
  // undefined for a slot that has neither a new file nor an existing URL
  // (matches CreateClientInput's "omit the field" convention for unset
  // optional data), or the existing URL unchanged if no replacement was
  // picked.
  const uploadPendingFiles = async (): Promise<{
    idDocumentFrontUrl?: string;
    idDocumentBackUrl?: string;
    selfieImageUrl?: string;
    consentDocumentUrl?: string;
  }> => {
    const resolveSlot = (
      file: File | null,
      existingUrl: string | null | undefined,
    ): Promise<string | undefined> =>
      file ? uploadDocument(file) : Promise.resolve(existingUrl ?? undefined);

    const [
      idDocumentFrontUrl,
      idDocumentBackUrl,
      selfieImageUrl,
      consentDocumentUrl,
    ] = await Promise.all([
      resolveSlot(idDocumentFrontFile, client?.idDocumentFrontUrl),
      resolveSlot(idDocumentBackFile, client?.idDocumentBackUrl),
      resolveSlot(selfieFile, client?.selfieImageUrl),
      resolveSlot(consentDocumentFile, client?.consentDocumentUrl),
    ]);
    return {
      idDocumentFrontUrl,
      idDocumentBackUrl,
      selfieImageUrl,
      consentDocumentUrl,
    };
  };

  // Diffs referenceRows against the references clientDetail actually had
  // when the form opened, and fires only the calls needed to reconcile
  // them — added rows (no `id`) → addReference, changed rows →
  // updateReference, rows present in the original set but no longer in
  // referenceRows → removeReference. Runs after the client itself is
  // successfully saved, since a brand-new client has no id to attach
  // references to until then.
  const syncReferences = async (clientId: string) => {
    const original = clientDetail?.references ?? [];
    const originalById = new Map(original.map((ref) => [ref.id, ref]));
    const currentIds = new Set(
      referenceRows.filter((row) => row.id).map((row) => row.id),
    );

    const removed = original.filter((ref) => !currentIds.has(ref.id));
    const additions = referenceRows.filter((row) => !row.id);
    const changed = referenceRows.filter((row) => {
      if (!row.id) {
        return false;
      }
      const before = originalById.get(row.id);
      return (
        before &&
        (before.type !== row.type ||
          before.fullName !== row.fullName ||
          before.phoneNumber !== row.phoneNumber ||
          before.relationship !== row.relationship)
      );
    });

    for (const ref of removed) {
      await removeReference.mutateAsync({ clientId, referenceId: ref.id });
    }
    for (const row of additions) {
      await addReference.mutateAsync({
        clientId,
        input: {
          type: row.type,
          fullName: row.fullName.trim(),
          phoneNumber: row.phoneNumber.trim(),
          relationship: row.relationship.trim(),
        },
      });
    }
    for (const row of changed) {
      await updateReference.mutateAsync({
        clientId,
        referenceId: row.id!,
        input: {
          type: row.type,
          fullName: row.fullName.trim(),
          phoneNumber: row.phoneNumber.trim(),
          relationship: row.relationship.trim(),
        },
      });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setIsUploading(true);
    let uploadedUrls;
    try {
      uploadedUrls = await uploadPendingFiles();
    } catch (err) {
      setFormError(
        err instanceof ImageUploadError
          ? err.message
          : 'No se pudo subir uno de los archivos. Intenta de nuevo.',
      );
      setIsUploading(false);
      return;
    }
    setIsUploading(false);

    setIsSubmitting(true);
    try {
      const savedClient = await onSubmit({
        firstName,
        lastName,
        documentNumber,
        phoneNumber,
        ...(creditLimit > 0 ? { creditLimit } : {}),
        ...(documentType ? { documentType: documentType as DocumentType } : {}),
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(documentIssuePlace.trim()
          ? { documentIssuePlace: documentIssuePlace.trim() }
          : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(alternatePhoneNumber.trim()
          ? { alternatePhoneNumber: alternatePhoneNumber.trim() }
          : {}),
        ...(homeAddress.trim() ? { homeAddress: homeAddress.trim() } : {}),
        ...(workAddress.trim() ? { workAddress: workAddress.trim() } : {}),
        ...(neighborhood.trim() ? { neighborhood: neighborhood.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(occupation.trim() ? { occupation: occupation.trim() } : {}),
        ...(employerName.trim() ? { employerName: employerName.trim() } : {}),
        ...(monthlyIncome > 0 ? { monthlyIncome } : {}),
        ...uploadedUrls,
        dataProcessingConsent,
      });

      try {
        await syncReferences(savedClient.id);
      } catch {
        // The client itself already saved successfully at this point — a
        // reference sync failure shouldn't look like the whole save
        // failed, but it does need to block the "close and forget"
        // behavior below so the admin knows to retry from the (now
        // editing) form instead of assuming everything saved.
        setFormError(
          'El cliente se guardó, pero una de las referencias no se pudo guardar. Vuelve a intentarlo.',
        );
        setIsSubmitting(false);
        return;
      }

      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        // Backend throws ConflictException("A client with document number
        // X already exists") for a duplicate cédula — surface that next to
        // the Cédula field instead of as a raw banner message, per Phase 3.
        if (err.statusCode === 409 && /document number/i.test(err.message)) {
          setFieldErrors({
            documentNumber: 'Ya existe un cliente registrado con esta cédula.',
          });
        } else if (err.statusCode === 400 && /consent/i.test(err.message)) {
          setFieldErrors({
            dataProcessingConsent:
              'El cliente debe autorizar el tratamiento de datos personales antes de guardar.',
          });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('No se pudo guardar el cliente. Intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isUploading || isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">
            {isEditing ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <CloseButton onClick={onClose} />
        </div>

        <p className="mt-1 text-label text-muted">
          {isEditing
            ? `Editando: ${client?.firstName} ${client?.lastName} · ID #${client?.id.slice(0, 8)}`
            : 'Solo administradores pueden crear clientes.'}
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-6">
          <FormSection title="Datos personales">
            <div className="flex gap-4">
              <Field label="Nombre" error={fieldErrors.firstName}>
                <input
                  required
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    setFieldErrors((prev) => ({
                      ...prev,
                      firstName: undefined,
                    }));
                  }}
                  placeholder="Ej: Carlos"
                  className={inputClassName(Boolean(fieldErrors.firstName))}
                />
              </Field>
              <Field label="Apellido" error={fieldErrors.lastName}>
                <input
                  required
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    setFieldErrors((prev) => ({
                      ...prev,
                      lastName: undefined,
                    }));
                  }}
                  placeholder="Ej: Mendoza"
                  className={inputClassName(Boolean(fieldErrors.lastName))}
                />
              </Field>
            </div>

            <div className="flex gap-4">
              <Field label="Cédula" error={fieldErrors.documentNumber}>
                <input
                  required
                  value={documentNumber}
                  onChange={(event) => {
                    setDocumentNumber(event.target.value);
                    setFieldErrors((prev) => ({
                      ...prev,
                      documentNumber: undefined,
                    }));
                  }}
                  placeholder="Ej: 1234567890"
                  className={inputClassName(
                    Boolean(fieldErrors.documentNumber),
                  )}
                />
              </Field>
              <Field label="Tipo de documento (opcional)">
                <Select
                  value={documentType}
                  onChange={setDocumentType}
                  options={DOCUMENT_TYPE_OPTIONS}
                  className="w-full"
                />
              </Field>
            </div>

            <div className="flex gap-4">
              <Field label="Fecha de nacimiento (opcional)">
                <DatePicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  className={inputClassName(false)}
                />
              </Field>
              <Field label="Lugar de expedición (opcional)">
                <input
                  value={documentIssuePlace}
                  onChange={(event) =>
                    setDocumentIssuePlace(event.target.value)
                  }
                  placeholder="Ej: Cali"
                  className={inputClassName(false)}
                />
              </Field>
            </div>

            <div className="flex gap-4">
              <Field label="Ocupación (opcional)">
                <input
                  value={occupation}
                  onChange={(event) => setOccupation(event.target.value)}
                  placeholder="Ej: Comerciante"
                  className={inputClassName(false)}
                />
              </Field>
              <Field label="Empresa (opcional)">
                <input
                  value={employerName}
                  onChange={(event) => setEmployerName(event.target.value)}
                  placeholder="Ej: Almacén La Economía"
                  className={inputClassName(false)}
                />
              </Field>
            </div>

            <div className="flex gap-4">
              <Field label="Ingreso mensual (opcional)">
                <CurrencyInput
                  value={monthlyIncome}
                  onChange={setMonthlyIncome}
                  placeholder="Sin especificar"
                  className={inputClassName(false)}
                />
              </Field>
              <Field label="Cupo (opcional)">
                <CurrencyInput
                  value={creditLimit}
                  onChange={setCreditLimit}
                  placeholder="Sin cupo (ilimitado)"
                  className={inputClassName(false)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Contacto">
            <div className="flex gap-4">
              <Field label="Celular" error={fieldErrors.phoneNumber}>
                <input
                  required
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    setFieldErrors((prev) => ({
                      ...prev,
                      phoneNumber: undefined,
                    }));
                  }}
                  placeholder="Ej: +573158001234"
                  className={inputClassName(Boolean(fieldErrors.phoneNumber))}
                />
              </Field>
              <Field label="Celular alterno (opcional)">
                <input
                  value={alternatePhoneNumber}
                  onChange={(event) =>
                    setAlternatePhoneNumber(event.target.value)
                  }
                  placeholder="Ej: +573001234567"
                  className={inputClassName(false)}
                />
              </Field>
            </div>
            <Field label="Correo electrónico (opcional)">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Ej: cliente@correo.com"
                className={inputClassName(false)}
              />
            </Field>
          </FormSection>

          <FormSection title="Direcciones">
            <Field label="Dirección de residencia (opcional)">
              <input
                value={homeAddress}
                onChange={(event) => setHomeAddress(event.target.value)}
                placeholder="Ej: Cra 10 #20-30"
                className={inputClassName(false)}
              />
            </Field>
            <Field label="Dirección de trabajo (opcional)">
              <input
                value={workAddress}
                onChange={(event) => setWorkAddress(event.target.value)}
                placeholder="Ej: Cl 5 #8-12, Local 3"
                className={inputClassName(false)}
              />
            </Field>
            <div className="flex gap-4">
              <Field label="Barrio (opcional)">
                <input
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                  placeholder="Ej: San Fernando"
                  className={inputClassName(false)}
                />
              </Field>
              <Field label="Ciudad (opcional)">
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Ej: Cali"
                  className={inputClassName(false)}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Referencias">
            <div className="flex flex-col gap-3">
              {referenceRows.length === 0 && (
                <p className="text-meta text-muted">
                  Sin referencias agregadas todavía.
                </p>
              )}
              {referenceRows.map((row) => (
                <div
                  key={row.rowId}
                  className="flex flex-col gap-2 rounded border border-border bg-input p-3"
                >
                  <div className="flex items-center justify-between">
                    <Select
                      value={row.type}
                      onChange={(value) =>
                        updateReferenceRow(row.rowId, {
                          type: value as ClientReferenceType,
                        })
                      }
                      options={Object.values(ClientReferenceType).map(
                        (type) => ({
                          value: type,
                          label: CLIENT_REFERENCE_TYPE_LABELS[type],
                        }),
                      )}
                      className="w-40"
                    />
                    <button
                      type="button"
                      onClick={() => removeReferenceRow(row.rowId)}
                      className="text-meta text-muted hover:text-red-400"
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={row.fullName}
                      onChange={(event) =>
                        updateReferenceRow(row.rowId, {
                          fullName: event.target.value,
                        })
                      }
                      placeholder="Nombre completo"
                      className="h-9 flex-1 rounded border border-border bg-background px-2.5 text-small text-white placeholder-mid focus:border-subtle focus:outline-none"
                    />
                    <input
                      value={row.phoneNumber}
                      onChange={(event) =>
                        updateReferenceRow(row.rowId, {
                          phoneNumber: event.target.value,
                        })
                      }
                      placeholder="Teléfono"
                      className="h-9 w-36 rounded border border-border bg-background px-2.5 text-small text-white placeholder-mid focus:border-subtle focus:outline-none"
                    />
                  </div>
                  <input
                    value={row.relationship}
                    onChange={(event) =>
                      updateReferenceRow(row.rowId, {
                        relationship: event.target.value,
                      })
                    }
                    placeholder="Relación — ej: hermano, vecino, proveedor"
                    className="h-9 rounded border border-border bg-background px-2.5 text-small text-white placeholder-mid focus:border-subtle focus:outline-none"
                  />
                </div>
              ))}
              {fieldErrors.references && (
                <span className="text-meta text-red-400" role="alert">
                  {fieldErrors.references}
                </span>
              )}
              <button
                type="button"
                onClick={addReferenceRow}
                className="self-start text-meta text-muted hover:text-white"
              >
                + Agregar referencia
              </button>
            </div>
          </FormSection>

          <FormSection title="Documentos">
            <Field label="Documento de identidad — frente (opcional)">
              <FileUploadField
                file={idDocumentFrontFile}
                onFileChange={setIdDocumentFrontFile}
                existingUrl={client?.idDocumentFrontUrl}
                disabled={isBusy}
              />
              <span className="mt-1 text-meta text-muted">
                Acepta foto o PDF — un PDF con ambos lados combinados puede
                subirse aquí, dejando "Reverso" vacío.
              </span>
            </Field>
            <Field label="Documento de identidad — reverso (opcional)">
              <FileUploadField
                file={idDocumentBackFile}
                onFileChange={setIdDocumentBackFile}
                existingUrl={client?.idDocumentBackUrl}
                disabled={isBusy}
              />
            </Field>
            <Field label="Selfie (opcional — el cliente puede negarse a proporcionarla)">
              <FileUploadField
                file={selfieFile}
                onFileChange={setSelfieFile}
                existingUrl={client?.selfieImageUrl}
                accept="image/*"
                disabled={isBusy}
              />
            </Field>
          </FormSection>

          <FormSection title="Autorización de tratamiento de datos">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={dataProcessingConsent}
                onChange={(event) => {
                  setDataProcessingConsent(event.target.checked);
                  setFieldErrors((prev) => ({
                    ...prev,
                    dataProcessingConsent: undefined,
                  }));
                }}
                className="mt-0.5 size-4 shrink-0 rounded border-border bg-input accent-white"
              />
              <span className="text-control text-white">
                El cliente firmó la autorización de tratamiento de datos.
              </span>
            </label>
            {fieldErrors.dataProcessingConsent && (
              <span className="text-meta text-red-400" role="alert">
                {fieldErrors.dataProcessingConsent}
              </span>
            )}
            {client?.consentGivenAt && (
              <p className="text-meta text-muted">
                Registrado el{' '}
                {new Date(client.consentGivenAt).toLocaleString('es-CO')}.
              </p>
            )}
            <Field label="Evidencia de la autorización firmada (opcional)">
              <FileUploadField
                file={consentDocumentFile}
                onFileChange={setConsentDocumentFile}
                existingUrl={client?.consentDocumentUrl}
                disabled={isBusy}
              />
            </Field>
          </FormSection>

          {formError && (
            <p className="text-small text-red-400" role="alert">
              {formError}
            </p>
          )}

          <div className="border-t border-border" />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading
                ? 'Subiendo archivos…'
                : isSubmitting
                  ? 'Guardando…'
                  : isEditing
                    ? 'Guardar cambios'
                    : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Shared input styling, switching to a red border when the field has a
// validation or API error attached — keeps the error visually anchored to
// the field it belongs to, not just a generic banner.
function inputClassName(hasError: boolean): string {
  const base =
    'h-[42px] w-full rounded border bg-input px-3.5 text-control text-white placeholder-mid focus:outline-none';
  return hasError
    ? `${base} border-red-500 focus:border-red-500`
    : `${base} border-border focus:border-subtle`;
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="text-[10px] font-medium tracking-[0.4px] text-muted">
        {label}
      </span>
      {children}
      {error && (
        <span className="text-meta text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// Phase 21 — groups the form into the sections
// docs/phasesClient/PHASE_21_CLIENT_PROFILE.md calls for, instead of one
// flat list of fields. Reuses the same `text-section-label` token
// ClientDetailPage.tsx's "PRÉSTAMOS"/"HISTORIAL DE MENSAJES" headers use.
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <span className="text-section-label font-medium tracking-[0.36px] text-muted">
        {title.toUpperCase()}
      </span>
      {children}
    </div>
  );
}
