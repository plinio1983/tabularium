import assert from 'node:assert/strict';
import test from 'node:test';
import {buildPeriodReport} from '../lib/reports';

const september = [{year: 2026, month: 9}];
const date = (value: string) => new Date(value);
function income(overrides: Record<string, unknown> = {}) {
  return {id: 1, amount: 1220, isFiscal: true, vatRate: 22, isCredited: true, invoiceStatus: 'EMESSA', billingYear: 2026, billingMonth: 9,
    credits: [{id: 1, amount: 1220, creditDate: date('2026-09-10T12:00:00Z')}], ...overrides};
}
function expense(overrides: Record<string, unknown> = {}) {
  return {id: 1, amount: 244, isDeclared: true, affectsFiscalProfit: false, expenseType: 'STANDARD', vatRate: 22, invoiceStatus: 'RICEVUTA', year: 2026, month: 9,
    receivedDate: date('2026-09-01'), dueDate: date('2026-09-20'), payments: [{id: 1, amount: 244, paymentDate: date('2026-09-10')}], ...overrides};
}
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`); }

function reconcile(report: ReturnType<typeof buildPeriodReport>) {
  close(report.expenseMovements.reduce((sum, movement) => sum + movement.amount, 0), report.totals.totalExpenses);
  close(report.incomeMovements.reduce((sum, movement) => sum + movement.amount, 0), report.totals.totalRevenue);
  close(report.monthlyBreakdown.reduce((sum, row) => sum + row.totals.speseTotali, 0), report.totals.totalExpenses);
  close(report.monthlyBreakdown.reduce((sum, row) => sum + row.totals.incassoTotale, 0), report.totals.totalRevenue);
}

test('complessivo: rate effettive, documenti precedenti e movimenti non fiscali', () => {
  const report = buildPeriodReport(september, [income({billingMonth: 8, credits: [
    {id: 1, amount: 610, creditDate: date('2026-09-10T12:00:00Z')},
    {id: 2, amount: 610, creditDate: date('2026-10-10T12:00:00Z')},
  ]}), income({id: 2, amount: 100, isFiscal: false, credits: [{amount: 100, creditDate: date('2026-09-15T12:00:00Z')}]}), income({id: 3, isCredited: false, credits: []})], [
    expense({month: 8, receivedDate: date('2026-08-01'), payments: [{amount: 122, paymentDate: date('2026-09-15')}, {amount: 122, paymentDate: date('2026-10-15')}]}),
    expense({id: 2, amount: 50, isDeclared: false, payments: [{amount: 50, paymentDate: date('2026-09-20')}]}),
    expense({id: 3, payments: []}),
  ], 'overall');
  close(report.totals.totalRevenue, 710);
  close(report.totals.totalExpenses, 172);
  close(report.totals.grossProfit, 538);
  close(report.totals.totalVatOnExpenses, 22);
  close(report.totals.vatToPay, 110);
  close(report.totals.estimatedNetProfit, 450);
  reconcile(report);
});

test('un pagamento futuro non cambia il report complessivo di un mese passato', () => {
  const past = buildPeriodReport(september, [income()], [expense({payments: []})], 'overall');
  const later = buildPeriodReport(september, [income()], [expense({payments: [{amount: 244, paymentDate: date('2026-10-01')}]})], 'overall');
  assert.deepEqual(later.totals, past.totals);
  close(later.totals.totalExpenses, 0);
  close(later.totals.estimatedNetProfit, 1000);
});

test('fiscale: documenti interi di competenza e IVA intera anche senza pagamenti', () => {
  for (const payments of [[], [{amount: 122, paymentDate: date('2026-09-10')}], [{amount: 244, paymentDate: date('2026-10-10')}]]) {
    const report = buildPeriodReport(september, [income({isCredited: false, credits: []}), income({id: 2, billingMonth: 8}), income({id: 3, isFiscal: false})], [expense({receivedDate: date('2026-08-01'), payments}), expense({id: 2, month: 8}), expense({id: 3, isDeclared: false})], 'fiscal');
    close(report.totals.totalRevenue, 1220);
    close(report.totals.totalExpenses, 244);
    close(report.totals.totalVatOnExpenses, 44);
    close(report.totals.declaredProfit, 800);
    assert.equal('estimatedTax' in report.totals, false);
    assert.equal('previsioneImposte' in report.summary, false);
    reconcile(report);
  }
});

test('saldo IVA: uscita di cassa separata dalle uscite fiscali, senza doppia sottrazione', () => {
  const settlement = expense({id: 2, amount: 176, expenseType: 'VAT_SETTLEMENT', isDeclared: false, vatRate: 0, payments: [{amount: 176, paymentDate: date('2026-09-20')}]});
  const overall = buildPeriodReport(september, [income()], [expense(), settlement], 'overall');
  close(overall.totals.totalExpenses, 420);
  close(overall.totals.grossProfit, 800);
  close(overall.totals.remainingVat, 0);
  close(overall.totals.estimatedNetProfit, 800);
  const fiscal = buildPeriodReport(september, [income()], [expense(), settlement], 'fiscal');
  close(fiscal.totals.totalExpenses, 244);
  close(fiscal.totals.declaredProfit, 800);
  close(fiscal.totals.paidVat, 176);
  close(fiscal.totals.remainingVat, 0);
  reconcile(overall); reconcile(fiscal);
  const unpaid = buildPeriodReport(september, [income()], [expense(), {...settlement, payments: []}], 'overall');
  close(unpaid.totals.totalExpenses, 244);
  close(unpaid.totals.estimatedNetProfit, 800);
});

test('imposte e personale rilevanti sono uscite fiscali senza IVA, anche non pagati', () => {
  const records = [expense({amount: 100, expenseType: 'PAYROLL', isDeclared: false, affectsFiscalProfit: true, payments: []}), expense({id: 2, amount: 50, expenseType: 'TAX_CONTRIBUTION', isDeclared: false, affectsFiscalProfit: true, payments: []})];
  const report = buildPeriodReport(september, [income()], records, 'fiscal');
  close(report.totals.totalExpenses, 150);
  close(report.totals.totalVatOnExpenses, 0);
  close(report.totals.declaredProfit, 850);
  reconcile(report);
});

test('i riepiloghi fiscali trimestrali non duplicano incassi non accreditati con scadenza diversa', () => {
  const periods = [7, 8, 9].map(month => ({year: 2026, month}));
  const report = buildPeriodReport(periods, [income({billingMonth: 7, isCredited: false, dueDate: date('2026-08-15'), credits: []})], [], 'fiscal');
  close(report.totals.vatToPay, 220);
  close(report.monthlyBreakdown.reduce((sum, row) => sum + row.totals.ivaGenerataIncassi, 0), 220);
  assert.deepEqual(report.monthlyBreakdown.map(row => row.totals.incassoTotale), [1220, 0, 0]);
  reconcile(report);
});

test('confini mensili: accrediti nel fuso aziendale e pagamenti come date civili', () => {
  const report = buildPeriodReport(september, [income({credits: [
    {amount: 100, creditDate: date('2026-08-31T21:59:59Z')},
    {amount: 200, creditDate: date('2026-08-31T22:00:00Z')},
    {amount: 300, creditDate: date('2026-09-30T21:59:59Z')},
    {amount: 400, creditDate: date('2026-09-30T22:00:00Z')},
  ]})], [expense({payments: [
    {amount: 10, paymentDate: date('2026-08-31')},
    {amount: 20, paymentDate: date('2026-09-01')},
    {amount: 30, paymentDate: date('2026-09-30')},
    {amount: 40, paymentDate: date('2026-10-01')},
    {amount: 50, paymentDate: null},
  ]})], 'overall', 'Europe/Rome');
  close(report.totals.totalRevenue, 500);
  close(report.totals.totalExpenses, 50);
  reconcile(report);
});

test('trimestre e anno complessivi sommano le quote di ogni mese, anche oltre il cambio anno', () => {
  const periods = [{year: 2025, month: 12}, {year: 2026, month: 1}, {year: 2026, month: 2}];
  const report = buildPeriodReport(periods, [income({credits: [{amount: 200, creditDate: date('2025-12-15')}, {amount: 300, creditDate: date('2026-01-15')} ]})], [expense({payments: [{amount: 61, paymentDate: date('2025-12-15')}, {amount: 183, paymentDate: date('2026-02-15')}]})], 'overall');
  reconcile(report);
  close(report.monthlyBreakdown.reduce((sum, row) => sum + row.totals.utileNetto, 0), report.totals.estimatedNetProfit);
  const annual = buildPeriodReport(Array.from({length:12}, (_, index) => ({year:2026, month:index+1})), [income()], [expense()], 'overall');
  reconcile(annual);
});

test('periodi senza movimenti restituiscono zero; il credito IVA non viene azzerato', () => {
  const empty = buildPeriodReport(september, [], [], 'overall');
  close(empty.totals.totalRevenue, 0); close(empty.totals.totalExpenses, 0); reconcile(empty);
  const credit = buildPeriodReport(september, [], [expense()], 'overall');
  close(credit.totals.remainingVat, -44);
  close(credit.totals.grossProfit, -244);
  close(credit.totals.estimatedNetProfit, -200);
});
