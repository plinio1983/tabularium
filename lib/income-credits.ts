export type IncomeCreditInput = {
  id?: number;
  creditDate: string;
  paymentMethodId: number;
  bankId: number;
  amount: number;
};

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).map(value => String(value ?? '').trim());
}

export function parseIncomeCredits(formData: FormData | null, jsonCredits: unknown): IncomeCreditInput[] {
  if (!formData) {
    if (!Array.isArray(jsonCredits)) return [];
    return jsonCredits.map((credit: any) => ({
      id: credit.id ? Number(credit.id) : undefined,
      creditDate: String(credit.creditDate ?? ''),
      paymentMethodId: Number(credit.paymentMethodId || 0),
      bankId: Number(credit.bankId || 0),
      amount: Number(credit.amount || 0),
    })).filter(hasCreditContent);
  }

  const ids = formValues(formData, 'creditId[]');
  const dates = formValues(formData, 'creditDate[]');
  const amounts = formValues(formData, 'creditAmount[]');
  const methodIds = formValues(formData, 'creditPaymentMethodId[]');
  const bankIds = formValues(formData, 'creditBankId[]');
  const length = Math.max(ids.length, dates.length, amounts.length, methodIds.length, bankIds.length);

  return Array.from({length}, (_, index) => ({
    id: ids[index] ? Number(ids[index]) : undefined,
    creditDate: dates[index] ?? '',
    paymentMethodId: Number(methodIds[index] || 0),
    bankId: Number(bankIds[index] || 0),
    amount: Number(String(amounts[index] || '0').replace(',', '.')),
  })).filter(hasCreditContent);
}

function hasCreditContent(credit: IncomeCreditInput) {
  return Boolean(credit.creditDate || credit.paymentMethodId || credit.bankId || credit.amount);
}

export function validateIncomeCredits(credits: IncomeCreditInput[], incomeAmount: number) {
  for (const credit of credits) {
    if (!credit.creditDate || !credit.paymentMethodId || !credit.bankId || !Number.isFinite(credit.amount) || credit.amount <= 0) {
      throw new Error('Completa tutti i campi degli accrediti.');
    }
  }
  const total = credits.reduce((sum, credit) => sum + credit.amount, 0);
  if (total > incomeAmount + 0.005) throw new Error("Il totale degli accrediti non può superare l’importo dell’incasso.");
  return {
    total,
    residual: Math.max(0, incomeAmount - total),
    isCredited: incomeAmount > 0 && total >= incomeAmount - 0.005,
  };
}

export function incomeCreditSummary(income: {amount: unknown; credits?: Array<{amount: unknown}>; isCredited?: boolean}) {
  const amount = Number(income.amount || 0);
  const credited = income.credits
    ? income.credits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0)
    : income.isCredited ? amount : 0;
  const residual = Math.max(0, amount - credited);
  return {
    amount,
    credited,
    residual,
    isCredited: amount > 0 && credited >= amount - 0.005,
    isPartiallyCredited: credited > 0 && credited < amount - 0.005,
  };
}
