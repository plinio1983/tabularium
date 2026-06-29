import { prisma } from '@/lib/prisma';
import RecurringExpensesList from '@/components/RecurringExpensesList';
import NewRecurringExpensePanel from '@/components/NewRecurringExpensePanel';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import { requireWorkspace } from '@/lib/auth';
import { orderBanks, orderExpenseCategories, orderPaymentMethods } from '@/lib/workspace-defaults';
import { stripFlashRecord } from '@/lib/flash';

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
  const current = await requireWorkspace('/recurring-expenses');
  const rawFilters = (await searchParams) ?? {};
  const filters = stripFlashRecord(rawFilters);
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
  const where: Record<string, any> = { workspaceId: current.workspace.id };

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

  const [items, categories, banks, paymentMethods, suppliers] = await Promise.all([
    prisma.recurringExpense.findMany({
      where,
      include: { supplier: true, category: true, bank: true, paymentMethod: true },
      orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }]
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  const orderedBanks = orderBanks(banks);
  const expensePaymentMethods = orderPaymentMethods(paymentMethods, 'EXPENSE');
  const orderedCategories = orderExpenseCategories(categories);
  const flashMessages = {
    savedMessages: {
      created: 'Spesa ricorrente creata.',
      updated: 'Spesa ricorrente aggiornata.',
      deleted: 'Spesa ricorrente rimossa.',
      bulk_updated: 'Spese ricorrenti aggiornate.',
      bulk_deleted: 'Spese ricorrenti rimosse.'
    },
    errorMessages: {
      invalid: 'Controlla i dati della spesa ricorrente.',
      supplier_not_found: 'Fornitore non trovato. Aggiungilo prima con il pulsante Nuovo nel campo Esercente, poi salva la spesa ricorrente.',
      not_found: 'Spesa ricorrente non trovata.',
      in_use: 'La spesa ricorrente è collegata ad altri movimenti.'
    }
  };

  return <div className="grid">
    <div className="toolbar-card expense-toolbar-card">
      <div><h2>Spese ricorrenti</h2><p className="muted">Gestisci le regole di spesa ricorrente.</p></div>
      <NewRecurringExpensePanel
        categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
        paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
      />
    </div>
    <ActionFeedbackBanner
      searchParams={rawFilters}
      savedMessages={flashMessages.savedMessages}
      errorMessages={flashMessages.errorMessages}
      defaultSavedMessage="Operazione completata."
      defaultErrorMessage="Impossibile completare l’operazione."
    />
    <RecurringExpensesList
      items={items}
      filters={filters}
      categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name, icon: c.icon }))}
      banks={orderedBanks.map(b => ({ id: b.id, name: b.name, isFallback: b.isFallback }))}
      paymentMethods={expensePaymentMethods.map(method => ({ id: method.id, name: method.name, kind: method.kind, isFallback: method.isFallback }))}
      suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias, email: s.email, phone: s.phone, pec: s.pec, taxCodeSdi: s.taxCodeSdi, internalNotes: s.internalNotes }))}
    />
  </div>;
}
