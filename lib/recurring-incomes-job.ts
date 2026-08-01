import { prisma } from '@/lib/prisma';
import { recurrenceBillingPeriod, recurrenceDates, recurrencePeriodKey, recurrenceStartOfDay } from '@/lib/recurrence-schedule';

type JobError = { recurringIncomeId: number; message: string };
export type RecurringIncomeJobResult = { checked: number; created: number; skipped: number; errors: JobError[] };
export type AutomaticIncomeCreditJobResult = { checked: number; created: number; skipped: number; errors: Array<{ incomeId: number; message: string }> };

export async function generateRecurringIncomes(todayInput = new Date()): Promise<RecurringIncomeJobResult> {
  const result: RecurringIncomeJobResult = { checked: 0, created: 0, skipped: 0, errors: [] };
  const definitions = await prisma.recurringIncome.findMany({ where: { isActive: true } });

  for (const definition of definitions) {
    result.checked++;
    try {
      const [defaultMethod, defaultBank] = await Promise.all([
        definition.paymentMethodId ? null : prisma.paymentMethod.findFirst({ where: { workspaceId: definition.workspaceId, kind: { in: ['INCOME', 'BOTH'] } }, orderBy: [{ isIncomeDefault: 'desc' }, { isFallback: 'desc' }, { id: 'asc' }] }),
        definition.bankId ? null : prisma.bank.findFirst({ where: { workspaceId: definition.workspaceId }, orderBy: [{ id: 'asc' }] })
      ]);
      const paymentMethodId = definition.paymentMethodId ?? defaultMethod?.id;
      const bankId = definition.bankId ?? defaultBank?.id;
      if (!paymentMethodId || !bankId) throw new Error('Metodo di accredito o banca predefinita mancanti');

      const today = recurrenceStartOfDay(todayInput);
      const endDate = definition.endDate ? recurrenceStartOfDay(definition.endDate) : null;
      const dates = recurrenceDates({ startDate: definition.startDate, endDate: definition.endDate, cadence: definition.cadence, day: definition.creditDay, month: definition.creditMonth }, today);
      if (!dates.length) result.skipped++;
      for (const creditDate of dates) {
        const billing = recurrenceBillingPeriod(definition, creditDate);
        // La chiave identifica l'occorrenza, non il mese contabile: più
        // occorrenze possono legittimamente confluire nello stesso periodo.
        const key = recurrencePeriodKey(creditDate.getFullYear(), creditDate.getMonth() + 1);
        const existing = await prisma.income.findFirst({ where: { recurringIncomeId: definition.id, recurringIncomePeriodKey: key } });
        if (existing) { result.skipped++; continue; }
        await prisma.income.create({ data: {
          workspaceId: definition.workspaceId, companyId: definition.companyId, customerId: definition.customerId,
          salesChannelId: definition.salesChannelId, incomeCategoryId: definition.incomeCategoryId,
          description: definition.description, amount: definition.amount, paymentMethodId, creditBankId: bankId,
          orderDate: creditDate, creditDate, dueDate: creditDate, isCredited: false,
          billingMonth: billing.month, billingYear: billing.year, isFiscal: definition.isFiscal,
          invoiceStatus: definition.isFiscal ? 'NON_INVIATA' : null, vatRate: definition.vatRate, notes: definition.notes,
          recurringIncomeId: definition.id, recurringIncomePeriodKey: key
        } });
        result.created++;
      }
      if (endDate && today > endDate) {
        await prisma.recurringIncome.update({where: {id: definition.id}, data: {isActive: false, archivedAt: today}});
      }
    } catch (error) {
      result.errors.push({ recurringIncomeId: definition.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

export async function settleAutomaticRecurringCredits(todayInput = new Date()): Promise<AutomaticIncomeCreditJobResult> {
  const result: AutomaticIncomeCreditJobResult = { checked: 0, created: 0, skipped: 0, errors: [] };
  const today = recurrenceStartOfDay(todayInput);
  const incomes = await prisma.income.findMany({
    where: { isCredited: false, dueDate: { lte: today }, recurringIncome: { isAutomaticCredit: true } },
    include: { credits: true, recurringIncome: true }
  });
  for (const income of incomes) {
    result.checked++;
    try {
      const definition = income.recurringIncome;
      if (!definition?.paymentMethodId || !definition.bankId) throw new Error('Metodo di accredito automatico o banca mancanti');
      const sourceKey = `recurring-income:${income.id}:automatic`;
      if (income.credits.some(credit => credit.sourceKey === sourceKey)) { result.skipped++; continue; }
      const credited = income.credits.reduce((sum, credit) => sum + Number(credit.amount), 0);
      const residual = Math.max(0, Number(income.amount) - credited);
      if (residual <= 0) { result.skipped++; continue; }
      await prisma.$transaction([
        prisma.incomeCredit.create({ data: { incomeId: income.id, creditDate: income.dueDate ?? income.creditDate, paymentMethodId: definition.paymentMethodId, bankId: definition.bankId, amount: residual, sourceKey } }),
        prisma.income.update({ where: { id: income.id }, data: { isCredited: true, paymentMethodId: definition.paymentMethodId, creditBankId: definition.bankId } })
      ]);
      result.created++;
    } catch (error) {
      result.errors.push({ incomeId: income.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

export async function runRecurringIncomesDailyJob(todayInput = new Date()) {
  return { generate: await generateRecurringIncomes(todayInput), credits: await settleAutomaticRecurringCredits(todayInput) };
}
