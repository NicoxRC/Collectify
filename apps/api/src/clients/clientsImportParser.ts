import ExcelJS from 'exceljs';

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'documentNumber',
  'phoneNumber',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

// Accepts both the Spanish headers the client's own spreadsheets use and
// their English equivalents — normalized (accents stripped, lowercased,
// trimmed) before matching, so "Cédula", "cedula", and " CEDULA " all match.
const HEADER_ALIASES: Record<RequiredField, string[]> = {
  firstName: ['nombre', 'nombres', 'first name', 'firstname'],
  lastName: ['apellido', 'apellidos', 'last name', 'lastname'],
  documentNumber: [
    'cedula',
    'documento',
    'numero de documento',
    'no de documento',
    'no documento',
    'document number',
  ],
  phoneNumber: [
    'telefono',
    'celular',
    'numero de telefono',
    'phone',
    'phone number',
  ],
};

export interface ParsedClientRow {
  row: number;
  firstName: string;
  lastName: string;
  documentNumber: string;
  phoneNumber: string;
}

export interface RowError {
  row: number;
  reason: string;
}

export interface ParseResult {
  rows: ParsedClientRow[];
  errors: RowError[];
}

// ExcelJS cell values are primitives for plain cells, but rich-text cells
// come back as { text } and formula cells as { result } — neither has a
// meaningful Object#toString, so each case is unwrapped explicitly instead
// of a blind String(value).
function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    if ('text' in value) {
      return cellText(value.text);
    }
    if ('result' in value) {
      return cellText(value.result);
    }
  }
  return '';
}

function normalizeHeader(value: unknown): string {
  return cellText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

// Parses a client-import workbook. Throws on structural problems (no
// sheet, unreadable file, missing required columns) — those abort the
// whole import. Per-row problems (missing a value in an otherwise valid
// row) are collected into `errors` instead, so one bad row doesn't sink
// the rest of the file — the confirmed "partial success" behavior for
// bulk onboarding, see docs/PROJECT_ROADMAP.md Phase 8.
export async function parseClientsWorkbook(
  buffer: Buffer,
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('The uploaded file has no sheets');
  }

  const columnByField = new Map<RequiredField, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(cell.value);
    for (const field of REQUIRED_FIELDS) {
      if (HEADER_ALIASES[field].includes(normalized)) {
        columnByField.set(field, colNumber);
      }
    }
  });

  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !columnByField.has(field),
  );
  if (missingFields.length > 0) {
    throw new Error(
      `The file is missing required column(s): ${missingFields.join(', ')}`,
    );
  }

  const rows: ParsedClientRow[] = [];
  const errors: RowError[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const values = Object.fromEntries(
      REQUIRED_FIELDS.map((field) => [
        field,
        cellText(row.getCell(columnByField.get(field)!).value),
      ]),
    ) as Record<RequiredField, string>;

    const isBlankRow = REQUIRED_FIELDS.every((field) => values[field] === '');
    if (isBlankRow) {
      return;
    }

    const missingValues = REQUIRED_FIELDS.filter(
      (field) => values[field] === '',
    );
    if (missingValues.length > 0) {
      errors.push({
        row: rowNumber,
        reason: `Missing value(s) for: ${missingValues.join(', ')}`,
      });
      return;
    }

    rows.push({ row: rowNumber, ...values });
  });

  return { rows, errors };
}
