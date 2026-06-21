import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import IncomeEditModalController from '@/components/IncomeEditModalController';
import { euro } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';
import { vatStyles } from '@/lib/expense-ui';
import {
  badgeClass,
  creditChannelStyles,
  fiscalStyles,
  incomeCreditStatusStyles,
  incomeInvoiceStatusStyles,
  paymentMethodStyles,
  saleCategoryStyles,
  salesChannelStyles
} from '@/lib/income-ui';

function dateLabel(value?: Date | null) {
  if (!value) return '-';
  const formatted = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(value);
  return formatted.replace(/\b([a-zàèéìòù])/, match => match.toUpperCase());
}

function vatAmountFromGross(amount: number, vatRate: number) {
  if (!vatRate) return 0;
  return amount * (vatRate / (100 + vatRate));
}

function formatPeriod(month: number, year: number) {
  const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(new Date(year, month - 1, 1));
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

function booleanBadge(value: boolean) {
  const item = value ? fiscalStyles.yes : fiscalStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function isIncomeCreditOverdue(income: { isCredited: boolean; creditDate: Date | null }) {
  return !income.isCredited && Boolean(income.creditDate) && localDateKey(income.creditDate!) < localDateKey(new Date());
}

function incomeCreditStatus(income: { isCredited: boolean; creditDate: Date | null }) {
  if (income.isCredited) return incomeCreditStatusStyles.ACCREDITATO;
  return isIncomeCreditOverdue(income) ? incomeCreditStatusStyles.SCADUTO : incomeCreditStatusStyles.DA_ACCREDITARE;
}

export default async function IncomeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/incomes');
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/incomes';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const currentDetailReturnTo = `/incomes/${id}?returnTo=${encodedReturnTo}`;
  const income = await prisma.income.findFirst({ where: { id: Number(id), workspaceId: current.workspace.id } });
  if (!income) notFound();

  const amount = Number(income.amount.toString());
  const vatRate = Number(income.vatRate.toString());
  const vatAmount = income.isFiscal ? vatAmountFromGross(amount, vatRate) : 0;
  const netAmount = amount - vatAmount;
  const salesStyle = salesChannelStyles[income.salesChannel];
  const categoryStyle = saleCategoryStyles[income.saleCategory];
  const paymentStyle = paymentMethodStyles[income.paymentMethod];
  const creditStyle = creditChannelStyles[income.creditChannel];
  const invoiceStyle = incomeInvoiceStatusStyles[income.invoiceStatus || 'NONE'] ?? incomeInvoiceStatusStyles.NONE;
  const creditStatus = incomeCreditStatus(income);
  const vatStyle = vatStyles[String(vatRate)] ?? vatStyles['0'];

  return <div className="grid income-detail-page">
    <IncomeEditModalController returnTo={currentDetailReturnTo} />


    <section className="expense-detail-hero card income-detail-hero">
      <div className="actions-row expense-detail-actions">
        <Link className="table-action secondary" href={returnTo}>↩ Indietro</Link>
        <Link className="table-action" href="#" data-income-edit-id={income.id}>✎ Modifica</Link>
      </div>
      <div className="expense-detail-hero-main">
        <div className="expense-detail-hero-main-meta">
          <div className="badge color-badge income-detail-badge">I</div>
          <div className="expense-detail-eyebrow">Dettaglio incasso #{income.id}</div>
        </div>
        <h2>{`${income.salesChannel}`}</h2>
        <div className="expense-detail-supplier">
          <span>{income.description ? `Incasso ${income.salesChannel} · ${income.saleCategory}` : 'Incasso senza descrizione'}</span>
        </div>
        <div className="expense-detail-hero-meta">
          {/*<span>{salesStyle?.icon ?? '•'} {income.salesChannel}</span>*/}
          <span>{categoryStyle?.icon ?? '•'} {income.saleCategory}</span>
          <span>Data accredito:<br /><strong>{dateLabel(income.creditDate)}</strong></span>
          <span>Periodo contabile:<br /><strong>{formatPeriod(income.billingMonth, income.billingYear)}</strong></span>
        </div>
      </div>
      <div className="expense-detail-hero-side-wrap">
        {/*<span className="text-pre">{paymentStyle?.icon ?? '•'} {income.paymentMethod} · {creditStyle?.icon ?? '•'} {income.creditChannel}</span>*/}
        <span className="text-pre">{dateLabel(income.creditDate)}</span>
        <div className="expense-detail-hero-side income-detail-hero-side">
          <span className="expense-detail-side-label">Importo incasso</span>
          <strong>{euro(amount)}</strong>
          <div className="detail-money-row income-detail-hero-badges">
            <span className={badgeClass(income.isFiscal ? 'tone-yes' : 'tone-neutral')}>{income.isFiscal ? 'DF' : 'NF'}</span>
            <span className={badgeClass(vatStyle.className)}>IVA {vatRate}%</span>
            <span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span>
          </div>
          <div className="income-detail-hero-net">
            <span>IVA esclusa</span>
            <strong>{euro(netAmount)}</strong>
          </div>
        </div>
      </div>
    </section>

    <section className="income-detail-summary-strip">
      {/*<div>*/}
      {/*  <span>IVA incasso</span>*/}
      {/*  <strong>{euro(vatAmount)}</strong>*/}
      {/*  <small><span className={badgeClass(vatStyle.className)}>{vatRate}%</span></small>*/}
      {/*</div>*/}
      <div>
        <span>Canale pagamento</span>
        <strong>{income.paymentMethod}</strong>
        <small>{income.creditChannel}</small>
      </div>
      <div>
        <span>Accredito</span>
        <strong><span className={badgeClass(creditStatus.className)}>{creditStatus.icon} {creditStatus.label}</span></strong>
        <small>{dateLabel(income.creditDate)}</small>
      </div>
      <div>
        <span>Fattura</span>
        <strong><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></strong>
        <small>{income.isFiscal ? 'Incasso fiscale' : 'Incasso non fiscale'}</small>
      </div>
    </section>

    <section className="card income-detail-grid-card">
      <div className="expense-detail-section-title">
        <div>
          <h2>Note</h2>
          <p className="muted">Annotazioni interne associate all’incasso.</p>
        </div>
      </div>
      <div className="detail-grid expense-detail-secondary-grid">
        <div className="full"><span>Note</span><strong>{income.notes ?? '-'}</strong></div>
      </div>
    </section>
  </div>;
}
