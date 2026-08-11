import { prisma } from './prisma';
import { isExpenseInvoiceNotReceived } from './expense-invoice';
import {expenseResidualAmount, isExpensePastDue} from './expense-calculations';
import {incomeCreditSummary} from './income-credits';
import {DEFAULT_COMPANY_TIME_ZONE, zonedMidnightUtc, yearMonthInTimeZone} from './company-time';

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

export function completedMonthCountForYear(year: number, now = new Date(), timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  const current = yearMonthInTimeZone(timeZone, now);
  if (year < current.year) return 12;
  if (year > current.year) return 0;
  return Math.max(0, current.month - 1);
}

function periodFromKey(key: number) {
  const year = Math.floor((key - 1) / 12);
  return { year, month: key - year * 12 };
}

function periodWhere(periods: Array<{ year: number; month: number }>, workspaceId?: number, companyId?: number) {
  return { ...(workspaceId ? { workspaceId } : {}), ...(companyId ? {companyId} : {}), OR: periods.map(({ year, month }) => ({ year, month })) };
}

function incomePeriodWhere(periods: Array<{ year: number; month: number }>, workspaceId?: number, companyId?: number) {
  return { ...(workspaceId ? { workspaceId } : {}), ...(companyId ? {companyId} : {}), OR: periods.map(({ year, month }) => ({ billingYear: year, billingMonth: month })) };
}

function monthDateRange(year: number, month: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1))
  };
}

function monthInstantRange(year: number, month: number, timeZone: string) {
  const next = new Date(Date.UTC(year, month, 1));
  return {
    gte: zonedMidnightUtc(`${year}-${String(month).padStart(2, '0')}-01`, timeZone),
    lt: zonedMidnightUtc(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`, timeZone)
  };
}

function incomePeriodWhereIncludingUncredited(periods: Array<{ year: number; month: number }>, workspaceId?: number, companyId?: number) {
  return {
    ...(workspaceId ? { workspaceId } : {}),
    ...(companyId ? {companyId} : {}),
    OR: [
      ...periods.map(({ year, month }) => ({ billingYear: year, billingMonth: month })),
      ...periods.map(({ year, month }) => ({ isCredited: false, dueDate: monthDateRange(year, month) }))
    ]
  };
}

function incomeMatchesPeriod(income: any, year: number, month: number) {
  if (Number(income.billingYear) === year && Number(income.billingMonth) === month) return true;
  if (income.isCredited) return false;
  const dueDate = income.dueDate ? new Date(income.dueDate) : null;
  return Boolean(dueDate && dueDate.getUTCFullYear() === year && dueDate.getUTCMonth() + 1 === month);
}

function periodRecordKey(record: any, kind: 'income' | 'expense') {
  return kind === 'income'
    ? periodKey(Number(record.billingYear), Number(record.billingMonth))
    : periodKey(Number(record.year), Number(record.month));
}

type SummaryOptions = {
  declaredExpensesOnlyForOpenTotals?: boolean;
  workspaceId?: number;
  companyId?: number;
  timeZone?: string;
};

function computeVatBalance(incomes: any[], expenses: any[], periods?: Array<{ year: number; month: number }>) {
  const periodKeys = periods?.length ? periods.map(({ year, month }) => periodKey(year, month)) : [];

  const incomeVatForKey = (key?: number) => incomes.reduce((sum, income) => {
    if (!income.isFiscal) return sum;
    if (key !== undefined) {
      const period = periodFromKey(key);
      if (!incomeMatchesPeriod(income, period.year, period.month)) return sum;
    }
    return sum + vatAmountFromGross(Number(income.amount), Number(income.vatRate));
  }, 0);

  const expenseVatForKey = (key?: number, kind: 'deductible' | 'settled' = 'deductible') => expenses.reduce((sum, expense) => {
    if (key !== undefined && periodRecordKey(expense, 'expense') !== key) return sum;
    const expenseAmount = Number(expense.amount);
    const paidAmount = Math.min(expenseAmount, (expense.payments ?? []).reduce((partial: number, payment: any) => partial + Number(payment.amount), 0));
    if (expense.expenseType === 'VAT_SETTLEMENT') return kind === 'settled' ? sum + paidAmount : sum;
    if (!expense.isDeclared || kind === 'settled') return sum;
    return sum + vatAmountFromGross(paidAmount, Number(expense.vatRate));
  }, 0);

  const generated = periodKeys.length > 1
    ? periodKeys.reduce((sum, key) => sum + incomeVatForKey(key), 0)
    : incomeVatForKey();
  const deductible = periodKeys.length > 1
    ? periodKeys.reduce((sum, key) => sum + expenseVatForKey(key, 'deductible'), 0)
    : expenseVatForKey(undefined, 'deductible');
  const settled = periodKeys.length > 1
    ? periodKeys.reduce((sum, key) => sum + expenseVatForKey(key, 'settled'), 0)
    : expenseVatForKey(undefined, 'settled');
  return { generated, deductible, settled, paid: deductible + settled, balance: generated - deductible - settled };
}


function isExpenseOverdue(expense: any) {
  return expenseResidualAmount(expense) > 0;
}

export function expenseAffectsFiscalProfit(expense: {expenseType?: unknown; isDeclared?: boolean; affectsFiscalProfit?: boolean}) {
  return expense.expenseType !== 'VAT_SETTLEMENT'
    && (expense.isDeclared || expense.affectsFiscalProfit);
}

function summarizeRecords(incomes: any[], expenses: any[], periods?: Array<{ year: number; month: number }>, options: SummaryOptions = {}) {
  const incassoTotale = incomes.reduce((sum, income) => sum + Number(income.amount), 0);
  const nonAccreditato = incomes.reduce((sum, income) => sum + incomeCreditSummary(income).residual, 0);
  const incassoFiscale = incomes.reduce((sum, income) => income.isFiscal ? sum + Number(income.amount) : sum, 0);
  const incassoNonFiscale = incassoTotale - incassoFiscale;

  const speseTotali = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const speseInDetrazione = expenses.reduce((sum, expense) => expenseAffectsFiscalProfit(expense) ? sum + Number(expense.amount) : sum, 0);
  const usciteNonFiscali = expenses.reduce((sum, expense) => expense.expenseType !== 'VAT_SETTLEMENT' && !expenseAffectsFiscalProfit(expense) ? sum + Number(expense.amount) : sum, 0);
  const usciteFiscali = speseInDetrazione;
  const openTotalExpenses = options.declaredExpensesOnlyForOpenTotals ? expenses.filter(expenseAffectsFiscalProfit) : expenses;
  const nonSaldato = openTotalExpenses.reduce((sum, expense) => sum + expenseResidualAmount(expense), 0);
  const fattureScadute = openTotalExpenses.reduce((sum, expense) => {
    if (!isExpensePastDue(expense, new Date(), options.timeZone)) return sum;
    return sum + expenseResidualAmount(expense);
  }, 0);
  const fattureScaduteCount = openTotalExpenses.reduce((sum, expense) => isExpensePastDue(expense, new Date(), options.timeZone) ? sum + 1 : sum, 0);

  const vatBalance = computeVatBalance(incomes, expenses, periods);
  const ivaGenerataIncassi = vatBalance.generated;
  const imponibileIncassi = incassoFiscale - ivaGenerataIncassi;
  const ivaVersataSpese = vatBalance.paid;
  const ivaDetraibileSpese = vatBalance.deductible;
  const ivaSaldoVersato = vatBalance.settled;
  const debitoIva = vatBalance.balance;
  const utileLordo = incassoTotale - speseTotali;
  // Il saldo IVA è già incluso nelle spese; si sottrae soltanto il debito IVA ancora aperto.
  const utileNetto = incassoTotale - speseTotali - debitoIva;
  // Il saldo IVA non è un costo deducibile. Per le spese fiscali si considera il solo imponibile.
  const utileFiscale = imponibileIncassi - (usciteFiscali - ivaDetraibileSpese);
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
    nonAccreditato,
    utileLordo,
    debitoIva,
    utileNetto,
    incassoFiscale,
    imponibileIncassi,
    incassoNonFiscale,
    speseInDetrazione,
    usciteFiscali,
    usciteNonFiscali,
    nonSaldato,
    utileFiscale,
    previsioneImposte,
    ivaGenerataIncassi,
    ivaVersataSpese,
    ivaDetraibileSpese,
    ivaSaldoVersato,
    fattureNonInviate,
    fattureNonRicevute,
    fattureScadute,
    fattureScaduteCount
  };
}

export async function getPeriodSummary(periods: Array<{ year: number; month: number }>, options: SummaryOptions = {}) {
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: incomePeriodWhereIncludingUncredited(periods, options.workspaceId, options.companyId), include: {credits: true} }),
    prisma.expense.findMany({ where: periodWhere(periods, options.workspaceId, options.companyId), include: { payments: { include: { paymentMethod: true }, orderBy: { id: 'asc' } } } })
  ]);

  return summarizeRecords(incomes, expenses, periods, options);
}

export async function getOrderDateMonthSummary(year: number, month: number, workspaceId?: number, companyId?: number, timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  return getOrderDatePeriodSummary([{ year, month }], workspaceId, companyId, timeZone);
}

export async function getOrderDatePeriodSummary(periods: Array<{ year: number; month: number }>, workspaceId?: number, companyId?: number, timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  const orderedPeriods = [...periods].sort((a, b) => periodKey(a.year, a.month) - periodKey(b.year, b.month));
  const first = orderedPeriods[0];
  const last = orderedPeriods[orderedPeriods.length - 1];
  if (!first || !last) return summarizeRecords([], []);

  const from = new Date(Date.UTC(first.year, first.month - 1, 1));
  const to = new Date(Date.UTC(last.year, last.month, 1));
  const instantFrom = monthInstantRange(first.year, first.month, timeZone).gte;
  const instantTo = monthInstantRange(last.year, last.month, timeZone).lt;

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { ...(workspaceId ? { workspaceId } : {}), ...(companyId ? {companyId} : {}), credits: {some: {creditDate: {gte: instantFrom, lt: instantTo}}} },
      include: {credits: {where: {creditDate: {gte: instantFrom, lt: instantTo}}}}
    }),
    prisma.expense.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), ...(companyId ? {companyId} : {}), receivedDate: { gte: from, lt: to } }, include: { payments: { include: { paymentMethod: true }, orderBy: { id: 'asc' } } } })
  ]);

  return summarizeRecords(incomes.map(income => ({
    ...income,
    amount: income.credits.reduce((sum, credit) => sum + Number(credit.amount), 0),
    isCredited: true,
  })), expenses);
}

export async function getAccountingDashboardReport(
  reportYear: number,
  now = new Date(),
  selectedMonth?: { year: number; month: number },
  selectedQuarter?: { year: number; quarterIndex: number },
  annualYear = reportYear,
  workspaceId?: number,
  companyId?: number,
  timeZone = DEFAULT_COMPANY_TIME_ZONE
) {
  const currentPeriod = yearMonthInTimeZone(timeZone, now);
  const currentYear = currentPeriod.year;
  const currentMonth = currentPeriod.month;
  const annualCompletedThroughMonth = completedMonthCountForYear(annualYear, now, timeZone);
  const reportCompletedThroughMonth = completedMonthCountForYear(reportYear, now, timeZone);
  const fiscalMonthPeriods = [selectedMonth ?? { year: currentYear, month: currentMonth }];
  const fiscalQuarterPeriods = selectedQuarter
    ? fiscalQuarterMonthsByIndex(selectedQuarter.year, selectedQuarter.quarterIndex)
    : fiscalQuarterMonths(currentYear, currentMonth);

  const reportYears = Array.from(new Set([reportYear, annualYear, fiscalMonthPeriods[0].year, fiscalQuarterPeriods[0]?.year ?? reportYear]));

  const reportPeriods = reportYears.flatMap(year => Array.from({ length: 12 }, (_, index) => ({ year, month: index + 1 })));

  const [currentFiscalMonth, currentFiscalQuarter, yearIncomes, yearExpenses] = await Promise.all([
    getPeriodSummary(fiscalMonthPeriods, { declaredExpensesOnlyForOpenTotals: true, workspaceId, companyId, timeZone }),
    getPeriodSummary(fiscalQuarterPeriods, { declaredExpensesOnlyForOpenTotals: true, workspaceId, companyId, timeZone }),
    prisma.income.findMany({ where: incomePeriodWhereIncludingUncredited(reportPeriods, workspaceId, companyId), include: { salesChannelRef: true, customer: true, paymentMethodRef: true, creditBank: true, credits: true } }),
    prisma.expense.findMany({ where: { ...(workspaceId ? { workspaceId } : {}), ...(companyId ? {companyId} : {}), year: { in: reportYears } }, include: { payments: { include: { paymentMethod: true }, orderBy: { id: 'asc' } }, category: true } })
  ]);

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthKey = periodKey(reportYear, month);
    const incomes = yearIncomes.filter(income => incomeMatchesPeriod(income, reportYear, month));
    const expenses = yearExpenses.filter(expense => periodKey(expense.year, expense.month) === monthKey);
    return { year: reportYear, month, totals: summarizeRecords(incomes, expenses, [{ year: reportYear, month }], {timeZone}) };
  });

  const annualCompletedPeriods = Array.from({ length: annualCompletedThroughMonth }, (_, index) => ({ year: annualYear, month: index + 1 }));
  const yearlyIncomes = yearIncomes.filter(income => annualCompletedPeriods.some(period => incomeMatchesPeriod(income, period.year, period.month)));
  const yearlyExpenses = yearExpenses.filter(expense => expense.year === annualYear && expense.month <= annualCompletedThroughMonth);
  const totals = summarizeRecords(yearlyIncomes, yearlyExpenses, annualCompletedPeriods, {timeZone});

  const reportYearExpenses = yearExpenses.filter(expense => expense.year === reportYear && expense.month <= reportCompletedThroughMonth);
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

  const incomesBySalesChannelMap = new Map<string, { name: string; code: string; total: number }>();
  for (const income of yearlyIncomes) {
    const salesChannel = income.salesChannelRef.name;
    const name = salesChannel;
    const code = income.salesChannelRef.code;
    const key = `${code}-${name}`;
    const current = incomesBySalesChannelMap.get(key) ?? { name, code, total: 0 };
    current.total += Number(income.amount);
    incomesBySalesChannelMap.set(key, current);
  }
  const incomesBySalesChannel = Array.from(incomesBySalesChannelMap.values()).sort((a, b) => b.total - a.total);

  const incomesByFiscalStatusMap = new Map<string, { name: string; code: string; total: number }>();
  for (const income of yearlyIncomes) {
    const name = income.isFiscal ? 'Dichiarato' : 'Non dichiarato';
    const code = income.isFiscal ? 'FISC' : 'NFISC';
    const key = `${code}-${name}`;
    const current = incomesByFiscalStatusMap.get(key) ?? { name, code, total: 0 };
    current.total += Number(income.amount);
    incomesByFiscalStatusMap.set(key, current);
  }
  const incomesByFiscalStatus = Array.from(incomesByFiscalStatusMap.values()).sort((a, b) => b.total - a.total);

  return {
    year: reportYear,
    annualYear,
    annualCompletedThroughMonth,
    reportCompletedThroughMonth,
    currentFiscalMonth: { periods: fiscalMonthPeriods, totals: currentFiscalMonth },
    currentFiscalQuarter: { periods: fiscalQuarterPeriods, totals: currentFiscalQuarter },
    months,
    totals,
    expensesByCategory,
    incomesBySalesChannel,
    incomesByFiscalStatus
  };
}

export async function getPeriodReport(periods: Array<{year: number; month: number}>, workspaceId?: number, mode: 'fiscal' | 'overall' = 'fiscal', companyId?: number, timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  if (!periods.length) throw new Error('At least one report period is required.');
  const dateRanges = periods.map(({year, month}) => monthDateRange(year, month));
  const instantRanges = periods.map(({year, month}) => monthInstantRange(year, month, timeZone));
  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({
      where: mode === 'fiscal'
        ? periodWhere(periods, workspaceId, companyId)
        : { ...(workspaceId ? { workspaceId } : {}), ...(companyId ? {companyId} : {}), OR: dateRanges.map(receivedDate => ({receivedDate})) },
      include: { category: true, company: true, supplier: true, payments: { include: { bank: true, paymentMethod: true }, orderBy: { id: 'asc' } } },
      orderBy: [{ receivedDate: 'asc' }, { id: 'asc' }]
    }),
    prisma.income.findMany({
      where: mode === 'fiscal'
        ? incomePeriodWhereIncludingUncredited(periods, workspaceId, companyId)
        : { ...(workspaceId ? { workspaceId } : {}), ...(companyId ? {companyId} : {}), credits: {some: {OR: instantRanges.map(creditDate => ({creditDate}))}} },
      include: {
        salesChannelRef: true, paymentMethodRef: true, creditBank: true, customer: true,
        credits: mode === 'fiscal' ? true : {where: {OR: instantRanges.map(creditDate => ({creditDate}))}}
      }
    })
  ]);

  const summaryIncomes = mode === 'fiscal' ? incomes : incomes.map(income => ({
    ...income,
    amount: income.credits.reduce((sum, credit) => sum + Number(credit.amount), 0),
    isCredited: true,
  }));
  const summary = summarizeRecords(summaryIncomes, expenses, mode === 'fiscal' ? periods : undefined, {timeZone});
  const monthlyBreakdown = periods.map(period => {
    const periodExpenses = mode === 'fiscal'
      ? expenses.filter(expense => Number(expense.year) === period.year && Number(expense.month) === period.month)
      : expenses.filter(expense => {
          if (!expense.receivedDate) return false;
          const receivedDate = new Date(expense.receivedDate);
          return receivedDate.getUTCFullYear() === period.year && receivedDate.getUTCMonth() + 1 === period.month;
        });
    const periodIncomes = mode === 'fiscal'
      ? incomes.filter(income => incomeMatchesPeriod(income, period.year, period.month))
      : incomes.flatMap(income => {
          const range = monthInstantRange(period.year, period.month, timeZone);
          const credits = income.credits.filter(credit => credit.creditDate >= range.gte && credit.creditDate < range.lt);
          if (!credits.length) return [];
          return [{...income, credits, amount: credits.reduce((sum, credit) => sum + Number(credit.amount), 0), isCredited: true}];
        });
    return {
      ...period,
      totals: summarizeRecords(periodIncomes, periodExpenses, mode === 'fiscal' ? [period] : undefined, {timeZone})
    };
  });
  const taxRate = 30;
  const estimatedTax = Math.max(summary.utileFiscale, 0) * taxRate / 100;

  return {
    year: periods[0].year,
    month: periods[0].month,
    periods,
    monthlyBreakdown,
    mode,
    expenses,
    incomes,
    revenues: [],
    totals: {
      totalExpenses: summary.speseTotali,
      totalVatOnExpenses: summary.ivaVersataSpese,
      totalRevenue: summary.incassoTotale,
      vatToPay: summary.ivaGenerataIncassi,
      paidVat: summary.ivaVersataSpese,
      remainingVat: summary.debitoIva,
      declaredProfit: summary.utileFiscale,
      grossProfit: summary.utileLordo,
      taxRate,
      estimatedTax,
      fixed: 0,
      estimatedNetProfit: summary.utileNetto
    }
  };
}

export async function getMonthlyReport(year: number, month: number, workspaceId?: number, mode: 'fiscal' | 'overall' = 'fiscal', companyId?: number, timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  return getPeriodReport([{year, month}], workspaceId, mode, companyId, timeZone);
}

export async function getYearReport(year: number, workspaceId?: number, companyId?: number, timeZone = DEFAULT_COMPANY_TIME_ZONE) {
  const months = await Promise.all(Array.from({ length: 12 }, (_, i) => getMonthlyReport(year, i + 1, workspaceId, 'fiscal', companyId, timeZone)));
  const totals = months.reduce((acc, m) => {
    for (const [k, v] of Object.entries(m.totals)) acc[k] = (acc[k] ?? 0) + Number(v);
    return acc;
  }, {} as Record<string, number>);
  return { year, months, totals };
}
