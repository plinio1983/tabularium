import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { euro } from '@/lib/money';
import { vatStyles } from '@/lib/expense-ui';
import {
  badgeClass,
  creditChannelStyles,
  fiscalStyles,
  incomeInvoiceStatusStyles,
  paymentMethodStyles,
  saleCategoryStyles,
  salesChannelStyles
} from '@/lib/income-ui';

function dateLabel(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
    : '-';
}

function vatAmountFromGross(amount: number, vatRate: number) {
  if (!vatRate) return 0;
  return amount * (vatRate / (100 + vatRate));
}

function formatPeriod(month: number, year: number) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

function booleanBadge(value: boolean) {
  const item = value ? fiscalStyles.yes : fiscalStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

export default async function IncomeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/incomes';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const currentDetailReturnTo = `/incomes/${id}?returnTo=${encodedReturnTo}`;
  const encodedCurrentDetailReturnTo = encodeURIComponent(currentDetailReturnTo);
  const income = await prisma.income.findUnique({ where: { id: Number(id) } });
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
  const vatStyle = vatStyles[String(vatRate)] ?? vatStyles['0'];

  return <div className="grid">
    <div className="toolbar-card">
      <div>
        <h2>Dettaglio incasso #{income.id}</h2>
        <p className="muted">Dati completi dell’entrata registrata.</p>
      </div>
      <div className="actions-row right-actions">
        <Link className="table-action secondary" href={returnTo}>↩ Lista incassi</Link>
        <Link className="table-action" href={`/incomes/${income.id}/edit?returnTo=${encodedCurrentDetailReturnTo}`}>✎ Modifica</Link>
      </div>
    </div>

    <div className="card detail-grid">
      <div><span>Importo</span><strong className="detail-amount">{euro(amount)}</strong></div>
      <div><span>IVA incasso</span><span className={badgeClass(vatStyle.className)}>{vatRate}% - {euro(vatAmount)}</span></div>
      <div><span>Importo IVA esclusa</span><strong>{euro(netAmount)}</strong></div>
      <div><span>Periodo Fatturazione</span><strong>{formatPeriod(income.billingMonth, income.billingYear)}</strong></div>
      <div><span>Data accredito</span><strong>{dateLabel(income.creditDate)}</strong></div>
      <div><span>Canale vendita</span><span className={badgeClass(salesStyle?.className)}>{salesStyle?.icon ?? '•'} {income.salesChannel}</span></div>
      <div><span>Categoria vendita</span><span className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {income.saleCategory}</span></div>
      <div><span>Metodo pagamento</span><span className={badgeClass(paymentStyle?.className)}>{paymentStyle?.icon ?? '•'} {income.paymentMethod}</span></div>
      <div><span>Canale accredito</span><span className={badgeClass(creditStyle?.className)}>{creditStyle?.icon ?? '•'} {income.creditChannel}</span></div>
      <div><span>Fiscale</span>{booleanBadge(income.isFiscal)}</div>
      <div><span>Stato fattura</span><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></div>
      <div><span>Creato</span><strong>{dateLabel(income.createdAt)}</strong></div>
      <div><span>Aggiornato</span><strong>{dateLabel(income.updatedAt)}</strong></div>
    </div>

    {income.notes && <div className="card"><h2>Note</h2><p>{income.notes}</p></div>}
  </div>;
}
