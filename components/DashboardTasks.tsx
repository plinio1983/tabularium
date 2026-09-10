import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {euro} from '@/lib/money';
import {summarizeDashboardTasks, expenseTaskLabels, incomeTaskLabels} from '@/lib/dashboard-tasks';

export default async function DashboardTasks({workspaceId, companyId, timeZone, now}: {
  workspaceId: number; companyId: number; timeZone: string; now: Date;
}) {
  const where = {workspaceId, companyId};
  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({where, select: {
      amount: true, dueDate: true, isDeclared: true, invoiceStatus: true, expenseType: true,
      payments: {select: {amount: true}},
    }}),
    prisma.income.findMany({where, select: {
      amount: true, isFiscal: true, invoiceStatus: true, incomeType: true, credits: {select: {amount: true}},
    }}),
  ]);
  const totals = summarizeDashboardTasks(expenses, incomes, now, timeZone);
  return <DashboardTasksSummary totals={totals}/>;
}

export function DashboardTasksSummary({totals}: {totals: ReturnType<typeof summarizeDashboardTasks>}) {
  const rows = [
    {label: expenseTaskLabels.overdue, href: '/expenses?pending=overdue', ...totals.overdue, detail: 'Residuo da pagare', critical: true},
    {label: incomeTaskLabels.missing_invoice, href: '/incomes?pending=missing_invoice', ...totals.invoicesNotEmitted, detail: 'Importo documenti', critical: false},
    {label: expenseTaskLabels.missing_invoice, href: '/expenses?pending=missing_invoice', ...totals.invoicesNotReceived, detail: 'Importo documenti', critical: false},
    {label: incomeTaskLabels.uncredited, href: '/incomes?pending=uncredited', ...totals.uncredited, detail: 'Residuo da incassare', critical: false},
  ];
  return <section id="da-gestire" className="card dashboard-tasks dashboard-anchor-section" aria-labelledby="dashboard-tasks-title">
    <div><h2 id="dashboard-tasks-title">Da gestire</h2><p className="muted">Situazione attuale · tutti i periodi, inclusi gli anni precedenti.</p></div>
    <div className="dashboard-task-list">{rows.map(row => <Link key={row.href} href={row.href}
      className={`dashboard-task-row ${row.count ? row.critical ? 'is-critical' : 'is-pending' : 'is-clear'}`}>
      <span className="dashboard-task-label">{row.label}<small>{row.count ? 'Apri la lista filtrata' : 'Nessuna pendenza'}</small></span>
      <span className="dashboard-task-count" aria-label={`${row.count} record`}>{row.count}</span>
      <span className="dashboard-task-amount"><strong>{euro(row.amount)}</strong><small>{row.detail}</small></span>
      <span aria-hidden="true">→</span>
    </Link>)}</div>
    <p className="muted dashboard-tasks-note">Le voci possono comprendere lo stesso documento; gli importi non vanno sommati.</p>
  </section>;
}
