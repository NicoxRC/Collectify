import ExcelJS from 'exceljs';

import { parseClientsWorkbook } from './clientsImportParser';

async function buildWorkbook(
  headers: string[],
  rows: (string | number | null)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Clientes');
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('parseClientsWorkbook', () => {
  it('parses rows using Spanish headers', async () => {
    const buffer = await buildWorkbook(
      ['Nombre', 'Apellido', 'Cédula', 'Teléfono'],
      [['Juana', 'Pérez', '1234567890', '+573001234567']],
    );

    const result = await parseClientsWorkbook(buffer);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        row: 2,
        firstName: 'Juana',
        lastName: 'Pérez',
        documentNumber: '1234567890',
        phoneNumber: '+573001234567',
      },
    ]);
  });

  it('matches headers case-insensitively and ignoring accents', async () => {
    const buffer = await buildWorkbook(
      ['  NOMBRE  ', 'apellido', 'CEDULA', 'telefono'],
      [['Carlos', 'Gomez', '9876543210', '+573002222222']],
    );

    const result = await parseClientsWorkbook(buffer);

    expect(result.rows).toHaveLength(1);
  });

  it('accepts English headers as an alternative', async () => {
    const buffer = await buildWorkbook(
      ['First Name', 'Last Name', 'Document Number', 'Phone'],
      [['Carlos', 'Gomez', '9876543210', '+573002222222']],
    );

    const result = await parseClientsWorkbook(buffer);

    expect(result.rows).toHaveLength(1);
  });

  it('skips fully blank rows without reporting an error', async () => {
    const buffer = await buildWorkbook(
      ['Nombre', 'Apellido', 'Cedula', 'Telefono'],
      [
        ['Juana', 'Pérez', '1234567890', '+573001234567'],
        [null, null, null, null],
        ['Carlos', 'Gomez', '9876543210', '+573002222222'],
      ],
    );

    const result = await parseClientsWorkbook(buffer);

    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('reports a row-level error when a required value is missing', async () => {
    const buffer = await buildWorkbook(
      ['Nombre', 'Apellido', 'Cedula', 'Telefono'],
      [['Juana', '', '1234567890', '+573001234567']],
    );

    const result = await parseClientsWorkbook(buffer);

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, reason: 'Missing value(s) for: lastName' },
    ]);
  });

  it('continues parsing subsequent rows after a row-level error', async () => {
    const buffer = await buildWorkbook(
      ['Nombre', 'Apellido', 'Cedula', 'Telefono'],
      [
        ['Juana', '', '1234567890', '+573001234567'],
        ['Carlos', 'Gomez', '9876543210', '+573002222222'],
      ],
    );

    const result = await parseClientsWorkbook(buffer);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].firstName).toBe('Carlos');
    expect(result.errors).toHaveLength(1);
  });

  it('throws when a required column is missing entirely', async () => {
    const buffer = await buildWorkbook(
      ['Nombre', 'Apellido', 'Cedula'],
      [['Juana', 'Pérez', '1234567890']],
    );

    await expect(parseClientsWorkbook(buffer)).rejects.toThrow(
      /missing required column/i,
    );
  });

  it('throws when the workbook has no sheets', async () => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await expect(parseClientsWorkbook(buffer)).rejects.toThrow(/no sheets/i);
  });
});
