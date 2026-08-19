import ExcelJS from 'exceljs';

import {
  allColumnDefinitions,
  CLIENT_COLUMNS,
  LOAN_COLUMNS,
  buildConceptColumnGroups,
} from './clientLoanImportColumns';
import { RowError } from './clientLoanImportParser';

// Human-friendly header labels, keyed by column key — separate from the
// alias list (which is lowercased/accent-stripped for matching) so the
// generated file reads naturally. Falls back to the first alias,
// title-cased, for anything not listed here explicitly.
const DISPLAY_HEADERS: Record<string, string> = {
  firstName: 'Nombre',
  lastName: 'Apellido',
  documentNumber: 'Cédula',
  phoneNumber: 'Teléfono',
  creditLimit: 'Cupo',
  documentType: 'Tipo de documento',
  dateOfBirth: 'Fecha de nacimiento',
  documentIssuePlace: 'Lugar de expedición',
  documentIssueDate: 'Fecha de expedición',
  email: 'Correo',
  alternatePhoneNumber: 'Teléfono alterno',
  homeAddress: 'Dirección de residencia',
  workAddress: 'Dirección de trabajo',
  neighborhood: 'Barrio',
  city: 'Ciudad',
  occupation: 'Ocupación',
  employerName: 'Empresa',
  monthlyIncome: 'Ingresos mensuales',
  promissoryNoteNumber: 'Pagaré',
  principalAmount: 'Monto del crédito',
  interestRate: 'Tasa moratoria (%)',
  disbursedAt: 'Fecha de desembolso',
  installmentFrequency: 'Frecuencia de pago (mensual/quincenal)',
  totalInstallments: 'Número de cuotas',
  initialPayment: 'Cuota inicial',
  description: 'Descripción del crédito',
};

function headerFor(key: string, fallbackAlias: string): string {
  return DISPLAY_HEADERS[key] ?? fallbackAlias;
}

function buildHeaders(): string[] {
  const headers = [
    ...CLIENT_COLUMNS.map((c) => headerFor(c.key, c.aliases[0])),
    ...LOAN_COLUMNS.map((c) => headerFor(c.key, c.aliases[0])),
  ];
  for (const group of buildConceptColumnGroups()) {
    headers.push(
      `Cargo adicional #${group.index} - Nombre`,
      `Cargo adicional #${group.index} - Tipo (porcentaje/fijo)`,
      `Cargo adicional #${group.index} - Valor`,
    );
  }
  return headers;
}

// GET /clients/import-template — an empty workbook with exactly the
// columns the parser accepts, built from the same column definitions
// (clientLoanImportColumns.ts) so the template and the parser can never
// drift apart. One row = one credit — a client with several loans
// appears on several rows with the same cédula, see
// ClientLoanImportService for how repeats are reconciled.
export async function buildImportTemplateWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Clientes y créditos');

  const headers = buildHeaders();
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map(() => ({ width: 26 }));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Regenerates a workbook containing only the rows that failed a given
// import attempt, with their original values pre-filled plus a trailing
// "Motivo del error" column — so the admin can fix just what's wrong and
// re-upload through the exact same endpoint, instead of retyping
// everything from scratch. Stateless: the caller (frontend) already has
// this exact `RowError[]` from the import response, nothing is persisted
// server-side between the import attempt and this call.
export async function buildImportErrorsWorkbook(
  errors: RowError[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Filas con error');

  const columns = allColumnDefinitions();
  const headers = [...buildHeaders(), 'Motivo del error'];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map(() => ({ width: 26 }));

  for (const error of errors) {
    const values = columns.map((column) => error.rawValues[column.key] ?? '');
    sheet.addRow([...values, error.reason]);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
