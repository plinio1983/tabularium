import { prisma } from './prisma';
import { isExpenseInvoiceNotReceived } from './expense-invoice';

export function vatAmountFromGross(amount: number, vatRate: number) {
  if (!vatRate) return 0;
  return amount * (vatRate / (100 + vatRate));
}

function fiscalQuarter(month: number) {
  return Math.floor((month - 1) / 3);
}

export function fiscalQuarterMonths(year: number, month: number) {
  const quarter = fiscalQuarter(month);
  const startMonth = quarter * 3 + 1;
  return Array.from({ length: 3 }, (_, index) => ({ year, month: startMonth + index }));
}

export function fiscalQuarterMonthsByIndex(year: number, quarterIndex: number) {
  const startMonth = quarterIndex * 3 + 1;
  return Array.from({ length: 3 }, (_, index) => ({ year, month: startMonth + index }));
}

function periodKey(year: number, month: number) {
  return year * 12 + month;
}

function periodWhere(periods: Array<{ year: number; month: number }>, workspaceId?: number) {
  return { ...(workspaceId ? { workspaceId } : {}), OR: periods.map(({ year, month }) => ({ year, month })) };
}

function incomePeriodWhere(periods: Array<{ year: number; month: number }>, workspaceId?: number) {
  return { ...(workspaceId ? { workspaceId } : {}), OR: periods.map(({ year, month }) => ({ billingYear: year, billingMonth: month })) };
}

function periodRecordKey(record: any, kind: 'income' | 'expense') {
  return kind === 'income'
    ? periodKey(Number(record.billingYear), Number(record.billingMonth))
    : periodKey(Number(record.year), Number(record.month));
}

type SummaryOptions = {
  declaredExpensesOnlyForOpenTotals?: boolean;
  workspaceId?: number;
};

function computeVatBalance(incomes: any[], expenses: any[], periods?: Array<{ year: number; month: number }>) {
  const periodKeys = periods?.length ? periods.map(({ year, month }) => periodKey(year, month)) : [];

  const incomeVatForKey = (key?: number) => incomes.reduce((sum, income) => {
    if (!income.isFiscal) return sum;
    if (key !== undefined && periodRecordKey(income, 'income') !== key) return sum;
    return sum + vatAmountFromGross(Number(income.amount), Number(income.vatRate));
  }, 0);

  const expenseVatForKey = (key?: number) => expenses.reduce((sum, expense) => {
    if (!expense.isDeclared) return sum;
    if (key !== undefined && periodRecordKey(expense, 'expense') !== key) return sum;
    const expenseAmount = Number(expense.amount);
    const paidAmount = Math.min(expenseAmount, (expense.payments ?? []).reduce((partial: number, payment: any) => partial + Number(payment.amount), 0));
    return sum + vatAmountFromGross(paidAmount, Number(expense.vatRate));
  }, 0);

  if (periodKeys.length > 1) {
    const generated = periodKeys.reduce((sum, key) => sum + incomeVatForKey(key), 0);
    const paid = periodKeys.reduce((sum, key) => sum + expenseVatForKey(key), 0);
    const balance = periodKeys.reduce((sum, key) => sum + Math.max(incomeVatForKey(key) - expenseVatForKey(key), 0), 0);
    return { generated, paid, balance };
  }

  const generated = incomeVatForKey();
  const paid = expenseVatForKey();
  return { generated, paid, balance: Math.max(generated - paid, 0) };
}


function expenseResidualAmount(expense: any) {
  const expenseAmount = Number(expense.amount);
  const paidAmount = (expense.payments ?? []).reduce((partial: number, payment: any) => partial + Number(payment.amount), 0);
  return Math.max(expenseAmount - paidAmount, 0);
}

function isExpenseOverdue(expense: any) {
  return expenseResidualAmount(expense) > 0;
}

function isExpensePastDue(expense: any) {
  if (!expense.dueDate) return false;
  if (expenseResidualAmount(expense) <= 0) return false;
  const due = new Date(expense.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function summarizeRecords(incomes: any[], expenses: any[], periods?: Array<{ year: number; month: number }>, options: SummaryOptions = {}) {
  const incassoTotale = incomes.reduce((sum, income) => sum + Number(income.amount), 0);
  const incassoFiscale = incomes.reduce((sum, income) => income.isFiscal ? sum + Number(income.amount) : sum, 0);
  const incassoNonFiscale = incassoTotale - incassoFiscale;

  const speseTotali = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const speseInDetrazione = expenses.reduce((sum, expense) => expense.isDeclared ? sum + Number(expense.amount) : sum, 0);
  const usciteNonFiscali = expenses.reduce((sum, expense) => expense.isDeclared ? sum : sum + Number(expense.amount), 0);
  const usciteFiscali = speseInDetrazione;
  const openTotalExpenses = options.declaredExpensesOnlyForOpenTotals ? expenses.filter(expense => expense.isDeclared) : expenses;
  const nonSaldato = openTotalExpenses.reduce((sum, expense) => sum + expenseResidualAmount(expense), 0);
  const fattureScadute = openTotalExpenses.reduce((sum, expense) => {
    if (!isExpensePastDue(expense)) return sum;
    return sum + expenseResidualAmount(expense);
  }, 0);
  const fattureScaduteCount = openTotalExpenses.reduce((sum, expense) => isExpensePastDue(expense) ? sum + 1 : sum, 0);

  const vatBalance = computeVatBalance(incomes, expenses, periods);
  const ivaGenerataIncassi = vatBalance.generated;
  const ivaVersataSpese = vatBalance.paid;
  const debitoIva = vatBalance.balance;
  const ivaComplessivaDaConsiderare = ivaVersataSpese + debitoIva;
  const utileLordo = incassoTotale - speseTotali;
  // Utile netto = Entrate totali - Uscite totali - IVA già saldata nelle spese - IVA ancora da saldare sugli incassi.
  const utileNetto = incassoTotale - speseTotali - ivaComplessivaDaConsiderare;
  // Utile fiscale = Entrate fiscali - Uscite fiscali - IVA già saldata nelle spese - IVA ancora da saldare sugli incassi.
  const utileFiscale = incassoFiscale - usciteFiscali - ivaComplessivaDaConsiderare;
  const previsioneImposte = Math.max(utileFiscale, 0) * 0.30;
  const fattureNonInviate = incomes.reduce((sum, income) => {
    if (!income.isFiscal) return sum;
    return income.invoiceStatus !== 'EMESSA' ? sum + 1 : sum;
  }, 0);
  const fattureNonRicevute = expenses.reduce((sum, expense) => {
    return isExpenseInvoiceNotReceived(expense) ? sum + 1 : sum;
  }, 0);

  return {
    speseTotali,
    incassoTotale,
    utileLordo,
    debitoIva,
    utileNetto,
    incassoFiscale,
    incassoNonFiscale,
    speseInDetrazione,
    usciteFiscali,
    usciteNonFiscali,
    nonSaldato,
    utileFiscale,
    previsioneImposte,
    ivaGenerataIncassi,
    ivaVersataSpese,
    fattureNonInviate,
    fattureNonRicevute,
    fattureScadute,
    fattureScaduteCount
  };
}

export async function getPeriodSummary(periods: Array<{ year: number; month: number }>, options: SummaryOptions = {}) {
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: incomePeriodWhere(periods, options.workspaceId) }),
    prisma.expense.findMany({ where: periodWhere(periods, options.workspaceId), include: { payments: true } })
  ]);

  return summarizeRecords(incomes, expenses, periods, options);
}

export async function getOrderDateMonthSummary(year: number, month: number, workspaceId?: number) {
  return getOrderDatePeriodSummary([{ year, month }], workspaceId);
}

export async function getOrderDatePeriodSummary(periods: Array<{ year: number; month: number }>, workspaceId?: number) {
  const orderedPeriods = [...periods].sort((a, b) => periodKey(a.year, a.month) - periodKey(b.year, b.month));
  const first = orderedPeriods[0];
  const last = orderedPeriods[orderedPeriods.length - 1];
  if (!first || !last) return summarizeRecords([], []);

  const from = new Date(first.year, first.month - 1, 1);
  const to = new Date(last.year, last.month, 1);

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), creditDate: { gte: from, lt: to } } }),
    prisma.expense.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), receivedDate: { gte: from, lt: to } }, include: { payments: true } })
  ]);

  return summarizeRecords(incomes, expenses);
}

export async function getAccountingDashboardReport(
  reportYear: number,
  now = new Date(),
  selectedMonth?: { year: number; month: number },
  selectedQuarter?: { year: number; quarterIndex: number },
  annualYear = reportYear,
  workspaceId?: number
) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fiscalMonthPeriods = [selectedMonth ?? { year: currentYear, month: currentMonth }];
  const fiscalQuarterPeriods = selectedQuarter
    ? fiscalQuarterMonthsByIndex(selectedQuarter.year, selectedQuarter.quarterIndex)
    : fiscalQuarterMonths(currentYear, currentMonth);

  const reportYears = Array.from(new Set([reportYear, annualYear, fiscalMonthPeriods[0].year, fiscalQuarterPeriods[0]?.year ?? reportYear]));

  const [currentFiscalMonth, currentFiscalQuarter, yearIncomes, yearExpenses] = await Promise.all([
    getPeriodSummary(fiscalMonthPeriods, { declaredExpensesOnlyForOpenTotals: true, workspaceId }),
    getPeriodSummary(fiscalQuarterPeriods, { declaredExpensesOnlyForOpenTotals: true, workspaceId }),
    prisma.income.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), billingYear: { in: reportYears } } }),
    prisma.expense.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), year: { in: reportYears } }, include: { payments: true, category: true } })
  ]);

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthKey = periodKey(reportYear, month);
    const incomes = yearIncomes.filter(income => periodKey(income.billingYear, income.billingMonth) === monthKey);
    const expenses = yearExpenses.filter(expense => periodKey(expense.year, expense.month) === monthKey);
    return { year: reportYear, month, totals: summarizeRecords(incomes, expenses, [{ year: reportYear, month }]) };
  });

  const yearlyIncomes = yearIncomes.filter(income => income.billingYear === annualYear);
  const yearlyExpenses = yearExpenses.filter(expense => expense.year === annualYear);
  const totals = summarizeRecords(yearlyIncomes, yearlyExpenses, Array.from({ length: 12 }, (_, index) => ({ year: annualYear, month: index + 1 })));

  const reportYearExpenses = yearExpenses.filter(expense => expense.year === reportYear);
  const categoryTotalsMap = new Map<string, { name: string; code: string; total: number }>();
  for (const expense of reportYearExpenses) {
    const name = expense.category?.name ?? 'Senza categoria';
    const code = expense.category?.code ?? 'ND';
    const key = `${code}-${name}`;
    const current = categoryTotalsMap.get(key) ?? { name, code, total: 0 };
    current.total += Number(expense.amount);
    categoryTotalsMap.set(key, current);
  }
  const expensesByCategory = Array.from(categoryTotalsMap.values()).sort((a, b) => b.total - a.total);

  return {
    year: reportYear,
    annualYear,
    currentFiscalMonth: { periods: fiscalMonthPeriods, totals: currentFiscalMonth },
    currentFiscalQuarter: { periods: fiscalQuarterPeriods, totals: currentFiscalQuarter },
    months,
    totals,
    expensesByCategory
  };
}

// Legacy monthly report kept for the old month detail pages.
export async function getMonthlyReport(year: number, month: number, workspaceId?: number) {
  const [expenses, revenues] = await Promise.all([
    prisma.expense.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), year, month }, include: { category: true, bank: true, company: true }, orderBy: [{ receivedDate: 'asc' }, { id: 'asc' }] }),
    prisma.monthlyRevenue.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), year, month }, include: { company: true } })
  ]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalVatOnExpenses = expenses.reduce((s, e) => s + vatAmountFromGross(Number(e.amount), Number(e.vatRate)), 0);
  const web = revenues.reduce((s, r) => s + Number(r.webAmount), 0);
  const shop = revenues.reduce((s, r) => s + Number(r.shopAmount), 0);
  const noInvoice = revenues.reduce((s, r) => s + Number(r.noInvoiceAmount), 0);
  const vatToPay = vatAmountFromGross(web + shop, 22);
  const paidVat = totalVatOnExpenses;
  const remainingVat = vatToPay - paidVat;
  const declaredProfit = web + shop - totalExpenses - remainingVat;
  const taxRate = Number(revenues[0]?.taxRate ?? 28);
  const estimatedTax = declaredProfit * taxRate / 100;
  const fixed = revenues.reduce((s, r) => s + Number(r.inps) + Number(r.accountant) + Number(r.tari), 0);
  const grossProfit = web + shop + noInvoice - totalExpenses - remainingVat;
  const estimatedNetProfit = grossProfit - estimatedTax - fixed;

  return { year, month, expenses, revenues, totals: { totalExpenses, totalVatOnExpenses, web, shop, noInvoice, totalRevenue: web + shop + noInvoice, vatToPay, paidVat, remainingVat, declaredProfit, grossProfit, taxRate, estimatedTax, fixed, estimatedNetProfit } };
}

export async function getYearReport(year: number, workspaceId?: number) {
  const months = await Promise.all(Array.from({ length: 12 }, (_, i) => getMonthlyReport(year, i + 1, workspaceId)));
  const totals = months.reduce((acc, m) => {
    for (const [k, v] of Object.entries(m.totals)) acc[k] = (acc[k] ?? 0) + Number(v);
    return acc;
  }, {} as Record<string, number>);
  return { year, months, totals };
}
