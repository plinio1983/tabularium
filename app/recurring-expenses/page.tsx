import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RecurringExpensesList from '@/components/RecurringExpensesList';

export default async function RecurringExpensesPage() {
  const items = await prisma.recurringExpense.findMany({
    include: { supplier: true, category: true, bank: true },
    orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }]
  });

  return <div className="grid">
    <div className="toolbar-card">
      <div><h2>Spese ricorrenti</h2><p className="muted">Gestisci le regole di spesa ricorrente.</p></div>
      <div className="toolbar-actions">
        <Link className="button-standard secondary-action" href="/expenses">↩ Lista spese</Link>
        <Link className="button-standard primary-action" href="/recurring-expenses/new"><span className="btn-icon">＋</span>Spesa ricorrente</Link>
      </div>
    </div>
    <RecurringExpensesList items={items} />
  </div>;
}
