import { prisma } from '@/lib/prisma';
import RecurringExpensesList from '@/components/RecurringExpensesList';
import NewRecurringExpensePanel from '@/components/NewRecurringExpensePanel';

const allowedBankOrder = ['MyTu', 'Unicredit', 'Wise', 'Altra Banca'];
const allowedCategoryOrder = [
  'Servizi Bancari',
  'Assicurazioni',
  'Affitti/Utenze',
  'Servizi Web',
  'Spedizioni/Corrieri',
  'Tasse/Imposte',
  'Altri Servizi',
  'Merce/Forniture',
  'Articoli di Supporto',
  'Prestazioni/Dipendenti',
  'Rateizzazione'
];

function inputDefault(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function decimalFilter(minValue: string, maxValue: string) {
  const min = Number(String(minValue || '').replace(',', '.'));
  const max = Number(String(maxValue || '').replace(',', '.'));
  const filter: Record<string, number> = {};
  if (Number.isFinite(min) && minValue !== '') filter.gte = min;
  if (Number.isFinite(max) && maxValue !== '') filter.lte = max;
  return Object.keys(filter).length ? filter : undefined;
}

export default async function RecurringExpensesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = (await searchParams) ?? {};
  const merchantFilter = inputDefault(filters, 'merchant').trim();
  const descriptionFilter = inputDefault(filters, 'description').trim();
  const categoryFilter = inputDefault(filters, 'categoryId');
  const activeFilter = inputDefault(filters, 'isActive');
  const cadenceFilter = inputDefault(filters, 'cadence');
  const billingModeFilter = inputDefault(filters, 'billingPeriodMode');
  const paymentFilter = inputDefault(filters, 'paymentChannel').trim();
  const bankFilter = inputDefault(filters, 'bankId');
  const amountMinFilter = inputDefault(filters, 'amountMin');
  const amountMaxFilter = inputDefault(filters, 'amountMax');
  const amountWhere = decimalFilter(amountMinFilter, amountMaxFilter);
  const where: Record<string, any> = {};

  if (merchantFilter) {
    where.OR = [
      { merchant: { contains: merchantFilter, mode: 'insensitive' } },
      { supplier: { businessName: { contains: merchantFilter, mode: 'insensitive' } } }
    ];
  }
  if (descriptionFilter) where.description = { contains: descriptionFilter, mode: 'insensitive' };
  if (categoryFilter) where.categoryId = Number(categoryFilter);
  if (activeFilter === 'true') where.isActive = true;
  if (activeFilter === 'false') where.isActive = false;
  if (cadenceFilter) where.cadence = cadenceFilter;
  if (billingModeFilter) where.billingPeriodMode = billingModeFilter;
  if (paymentFilter) where.paymentChannel = { contains: paymentFilter, mode: 'insensitive' };
  if (bankFilter) where.bankId = Number(bankFilter);
  if (amountWhere) where.amount = amountWhere;

  const [items, categories, banks, suppliers] = await Promise.all([
    prisma.recurringExpense.findMany({
      where,
      include: { supplier: true, category: true, bank: true },
      orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }]
    }),
    prisma.expenseCategory.findMany({ orderBy: { id: 'asc' } }),
    prisma.bank.findMany(),
    prisma.supplier.findMany({ orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  const orderedBanks = allowedBankOrder.map(name => banks.find(bank => bank.name === name)).filter(Boolean) as typeof banks;
  const orderedCategories = allowedCategoryOrder.map(name => categories.find(category => category.name === name)).filter(Boolean) as typeof categories;

  return <div className="grid">
    <div className="toolbar-card">
      <div><h2>Spese ricorrenti</h2><p className="muted">Gestisci le regole di spesa ricorrente.</p></div>
      <NewRecurringExpensePanel
        categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
      />
    </div>
    <RecurringExpensesList
      items={items}
      filters={filters}
      categories={orderedCategories.map(c => ({ id: c.id, name: c.name }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
    />
  </div>;
}
