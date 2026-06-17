import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RecurringExpenseForm from '@/components/RecurringExpenseForm';
import { requireWorkspace } from '@/lib/auth';

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

export default async function NewRecurringExpensePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/recurring-expenses/new');
  const params = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/recurring-expenses';
  const encodedReturnTo = encodeURIComponent(returnTo);

  const [categories, banks, suppliers] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { id: 'asc' } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.supplier.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' }, take: 100 })
  ]);

  const orderedBanks = allowedBankOrder.map(name => banks.find(bank => bank.name === name)).filter(Boolean) as typeof banks;
  const orderedCategories = allowedCategoryOrder.map(name => categories.find(category => category.name === name)).filter(Boolean) as typeof categories;

  return <div className="modal-page-wrap">
    <div className="modal-card modal-card-wide modal-page-card">
      <div className="toolbar-card modal-toolbar-card">
        <div><h2>Spesa ricorrente</h2><p className="muted">Configura una regola ricorrente.</p></div>
        <Link className="table-action secondary" href={returnTo}>↩ Annulla</Link>
      </div>
      <RecurringExpenseForm
        categories={orderedCategories.map(c => ({ id: c.id, code: c.code, name: c.name }))}
        banks={orderedBanks.map(b => ({ id: b.id, name: b.name }))}
        suppliers={suppliers.map(s => ({ id: s.id, businessName: s.businessName, alias: s.alias }))}
        action={`/api/recurring-expenses?returnTo=${encodedReturnTo}`}
        cancelHref={returnTo}
      />
    </div>
  </div>;
}
