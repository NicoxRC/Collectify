// Renders the overdue reminder message — confirmed real format from
// docs/GLOSSARY.md → "Overdue reminder":
//
//   [Client greeting]
//   1️⃣ La cuota No. X del pagaré #Y por $Z (incluidos intereses) venció hace N días.
//   2️⃣ ...
//   El valor a pagar hoy es $[grand total]
//
// The per-installment line format is fixed (matches the confirmed real
// message exactly, per docs/DATABASE.md's placeholder structure) — only the
// outer template (greeting + where the list/total go) is admin-editable via
// MessageTemplate.content, using {{clientFullName}}, {{installmentsList}},
// {{grandTotal}}.

const NUMBER_EMOJIS = [
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🔟',
];

export interface OverdueInstallmentForMessage {
  installmentNumber: number;
  promissoryNoteNumber: string;
  totalDue: number;
  overdueDays: number;
}

function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('es-CO');
}

function bulletForIndex(index: number): string {
  return NUMBER_EMOJIS[index] ?? `${index + 1}.`;
}

function renderInstallmentLine(
  item: OverdueInstallmentForMessage,
  index: number,
): string {
  return (
    `${bulletForIndex(index)} La cuota No. ${item.installmentNumber} del pagaré ` +
    `#${item.promissoryNoteNumber} por $${formatCurrency(item.totalDue)} ` +
    `(incluidos intereses) venció hace ${item.overdueDays} días.`
  );
}

export function calculateGrandTotal(
  installments: OverdueInstallmentForMessage[],
): number {
  return installments.reduce((sum, item) => sum + item.totalDue, 0);
}

export function renderOverdueReminderMessage(
  templateContent: string,
  clientFullName: string,
  installments: OverdueInstallmentForMessage[],
): string {
  const installmentsList = installments.map(renderInstallmentLine).join('\n');
  const grandTotal = formatCurrency(calculateGrandTotal(installments));

  return templateContent
    .replaceAll('{{clientFullName}}', clientFullName)
    .replaceAll('{{installmentsList}}', installmentsList)
    .replaceAll('{{grandTotal}}', grandTotal);
}
