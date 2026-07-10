import {
  calculateGrandTotal,
  OverdueInstallmentForMessage,
  renderOverdueReminderMessage,
} from './messageRenderer';

const TEMPLATE = [
  'Hola {{clientFullName}}, tienes cuotas vencidas:',
  '{{installmentsList}}',
  'El valor a pagar hoy es ${{grandTotal}}',
].join('\n');

describe('messageRenderer', () => {
  describe('renderOverdueReminderMessage', () => {
    it('renders a single overdue installment', () => {
      const installments: OverdueInstallmentForMessage[] = [
        {
          installmentNumber: 3,
          promissoryNoteNumber: '743',
          totalDue: 520800,
          overdueDays: 740,
        },
      ];

      const message = renderOverdueReminderMessage(
        TEMPLATE,
        'Juana Pérez',
        installments,
      );

      expect(message).toContain('Hola Juana Pérez, tienes cuotas vencidas:');
      expect(message).toContain(
        '1️⃣ La cuota No. 3 del pagaré #743 por $520.800 (incluidos intereses) venció hace 740 días.',
      );
      expect(message).toContain('El valor a pagar hoy es $520.800');
    });

    it('renders multiple installments across multiple loans, numbered in order, with a grand total', () => {
      const installments: OverdueInstallmentForMessage[] = [
        {
          installmentNumber: 3,
          promissoryNoteNumber: '743',
          totalDue: 520800,
          overdueDays: 740,
        },
        {
          installmentNumber: 1,
          promissoryNoteNumber: '959',
          totalDue: 1023360,
          overdueDays: 484,
        },
        {
          installmentNumber: 2,
          promissoryNoteNumber: '959',
          totalDue: 994446,
          overdueDays: 409,
        },
      ];

      const message = renderOverdueReminderMessage(
        TEMPLATE,
        'Juana Pérez',
        installments,
      );

      expect(message).toContain('1️⃣ La cuota No. 3 del pagaré #743');
      expect(message).toContain('2️⃣ La cuota No. 1 del pagaré #959');
      expect(message).toContain('3️⃣ La cuota No. 2 del pagaré #959');
      // 520800 + 1023360 + 994446 = 2538606
      expect(message).toContain('El valor a pagar hoy es $2.538.606');
    });
  });

  describe('calculateGrandTotal', () => {
    it('sums totalDue across every included installment', () => {
      const installments: OverdueInstallmentForMessage[] = [
        {
          installmentNumber: 1,
          promissoryNoteNumber: '743',
          totalDue: 520800,
          overdueDays: 740,
        },
        {
          installmentNumber: 1,
          promissoryNoteNumber: '959',
          totalDue: 1023360,
          overdueDays: 484,
        },
      ];

      expect(calculateGrandTotal(installments)).toBe(1544160);
    });

    it('returns 0 for an empty list', () => {
      expect(calculateGrandTotal([])).toBe(0);
    });
  });
});
