export const companyUsageSelect = {
  expenses: true, incomes: true, recurringExpenses: true, recurringIncomes: true,
  employees: true, revenues: true, notifications: true
} as const;

export type CompanyUsage = Record<keyof typeof companyUsageSelect, number>;

export function companyUsageSummary(counts: CompanyUsage) {
  const labels: Record<keyof CompanyUsage, string> = {
    expenses: 'spese', incomes: 'incassi', recurringExpenses: 'spese ricorrenti',
    recurringIncomes: 'incassi ricorrenti', employees: 'dipendenti', revenues: 'riepiloghi mensili', notifications: 'notifiche'
  };
  return (Object.keys(labels) as Array<keyof CompanyUsage>)
    .filter(key => counts[key] > 0).map(key => `${counts[key]} ${labels[key]}`).join(' · ');
}
