import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { euro } from '@/lib/money';
import {
  badgeClass,
  bankIcons,
  categoryStyles,
  formatPeriod,
  invoiceStatusStyles,
  paymentStatusStyles,
  vatKey,
  vatStyles,
  yesNoStyles
} from '@/lib/expense-ui';

function dateLabel(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
    : '-';
}

function paidByLabel(value: string) {
  return value === 'ALTRO_OPERATORE' ? 'Altro Operatore' : 'Herbal Market';
}

function booleanBadge(value: boolean) {
  const item = value ? yesNoStyles.yes : yesNoStyles.no;
  return <span className={badgeClass(item.className)}>{item.icon} {item.label}</span>;
}

function DetailItem({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? 'expense-detail-item expense-detail-item-wide' : 'expense-detail-item'}>
    <span>{label}</span>
    <strong>{children}</strong>
  </div>;
}

export default async function ExpenseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/expenses';
  const encodedReturnTo = encodeURIComponent(returnTo);
  const currentDetailReturnTo = `/expenses/${id}?returnTo=${encodedReturnTo}`;
  const encodedCurrentDetailReturnTo = encodeURIComponent(currentDetailReturnTo);
  const expense = await prisma.expense.findUnique({
    where: { id: Number(id) },
    include: { category: true, bank: true, supplier: true, payments: { include: { bank: true }, orderBy: { id: 'asc' } }, attachments: true }
  });

  if (!expense) notFound();

  const amount = Number(expense.amount.toString());
  const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
  const paidCapped = Math.min(amount, paid);
  const residual = Math.max(0, amount - paid);
  const categoryStyle = expense.category?.name ? categoryStyles[expense.category.name] : undefined;
  const paymentStyle = paymentStatusStyles[expense.paymentStatus] ?? paymentStatusStyles.DA_PAGARE;
  const invoiceStyle = invoiceStatusStyles[expense.invoiceStatus] ?? invoiceStatusStyles.IN_ATTESA;
  const vatStyle = vatStyles[vatKey(expense.vatRate)] ?? vatStyles['22'];
  const vatRate = Number(expense.vatRate.toString());
  const paidVat = vatRate ? paidCapped * (vatRate / (100 + vatRate)) : 0;
  const supplierName = expense.supplier?.businessName || expense.merchant;
  const paidPercent = amount > 0 ? Math.min(100, Math.round((paidCapped / amount) * 100)) : 0;
  const hasResidual = residual > 0;

  return <div className="expense-detail-page">
    <div className="expense-detail-shell">
      <section className="expense-detail-document">
        <header className="expense-detail-hero">
          <div className="expense-detail-title-block">
            <Link className="expense-detail-back" href={returnTo}>← Lista spese</Link>
            <p className="expense-detail-kicker">{formatPeriod(expense.month, expense.year)}</p>
            <h1>{supplierName}</h1>
            <div className="expense-detail-supplier-name">{expense.description || 'Spesa senza descrizione'}</div>
            <div className="expense-detail-meta-line">
              <span>Ordine {dateLabel(expense.receivedDate)}</span>
              <span>Scadenza {dateLabel(expense.dueDate)}</span>
            </div>
          </div>

          <div className="expense-detail-amount-panel">
            <span>Importo +IVA</span>
            <strong>{euro(amount)}</strong>
            <div className="expense-detail-badge-row">
              <span className={badgeClass(paymentStyle.className)}>{paymentStyle.icon} {paymentStyle.label}</span>
              <span className={badgeClass(vatStyle.className)}>{vatStyle.label}</span>
            </div>
          </div>
        </header>

        <div className="expense-detail-action-row">
          <Link className="button-standard secondary-button" href={`/expenses/new?copyId=${expense.id}&returnTo=${encodedCurrentDetailReturnTo}`}>⧉ Copia spesa</Link>
          <Link className="button-standard primary-action" href={`/expenses/${expense.id}/edit?returnTo=${encodedCurrentDetailReturnTo}`}>✎ Modifica</Link>
        </div>

        <section className="expense-detail-status-strip" aria-label="Riepilogo contabile">
          <div>
            <span>Pagato</span>
            <strong className="text-ok">{euro(paidCapped)}</strong>
          </div>
          <div>
            <span>Residuo</span>
            <strong className={hasResidual ? 'text-warning' : 'text-ok'}>{euro(residual)}</strong>
          </div>
          <div>
            <span>IVA pagata</span>
            <strong>{euro(paidVat)}</strong>
          </div>
          <div>
            <span>Avanzamento</span>
            <strong>{paidPercent}%</strong>
          </div>
        </section>

        <div className="expense-detail-progress" aria-hidden="true">
          <span style={{ width: `${paidPercent}%` }} />
        </div>

        <section className="expense-detail-section">
          <div className="expense-detail-section-heading">
            <h2>Dati principali</h2>
            <p>Informazioni operative e fiscali della spesa.</p>
          </div>

          <div className="expense-detail-info-grid">
            <DetailItem label="Periodo fatturazione">{formatPeriod(expense.month, expense.year)}</DetailItem>
            <DetailItem label="Data ordine">{dateLabel(expense.receivedDate)}</DetailItem>
            <DetailItem label="Data scadenza">{dateLabel(expense.dueDate)}</DetailItem>
            <DetailItem label="Categoria">
              {expense.category ? <span className={badgeClass(categoryStyle?.className)}>{categoryStyle?.icon ?? '•'} {expense.category.name}</span> : '-'}
            </DetailItem>
            {/*<DetailItem label="Esercente/Fornitore">{supplierName}</DetailItem>*/}
            <DetailItem label="Fattura elettronica">{booleanBadge(expense.hasElectronicInvoice)}</DetailItem>
            <DetailItem label="Stato fattura"><span className={badgeClass(invoiceStyle.className)}>{invoiceStyle.icon} {invoiceStyle.label}</span></DetailItem>
            <DetailItem label="Detrazione">{booleanBadge(expense.isDeclared)}</DetailItem>
            {/*<DetailItem label="Banca principale">{expense.bank ? `${bankIcons[expense.bank.name] ?? '🏦'} ${expense.bank.name}` : '-'}</DetailItem>*/}
            <DetailItem label="Note" wide>{expense.notes || '-'}</DetailItem>
          </div>
        </section>

        <section className="expense-detail-section">
          <div>
            <div className="expense-detail-section-heading">
              <h2>Pagamenti</h2>
              <p>{expense.payments.length ? `${expense.payments.length} pagamento/i registrato/i.` : 'Nessun pagamento registrato.'}</p>
            </div>

            {expense.payments.length ? (
              <div className="expense-payment-timeline">
                {expense.payments.map(payment => (
                  <div className="expense-payment-card" key={payment.id}>
                    <div className="expense-payment-date">
                      <span>{dateLabel(payment.paymentDate)}</span>
                      <strong>{euro(payment.amount.toString())}</strong>
                    </div>
                    <div className="expense-payment-data">
                      <div><span>Canale</span><strong>{payment.channel ?? '-'}</strong></div>
                      <div><span>Banca</span><strong>{payment.bank ? `${bankIcons[payment.bank.name] ?? '🏦'} ${payment.bank.name}` : '-'}</strong></div>
                      <div><span>Effettuato da</span><strong>{paidByLabel(payment.paidBy)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="expense-empty-panel">Nessun pagamento registrato per questa spesa.</div>
            )}
          </div>

          <div>
            <div className="expense-detail-section-heading">
              <h2>Allegati</h2>
              <p>{expense.attachments.length ? `${expense.attachments.length} file collegato/i.` : 'Nessun file caricato.'}</p>
            </div>

            {expense.attachments.length ? (
              <div className="expense-attachment-panel">
                {expense.attachments.map(attachment => (
                  <a className="expense-attachment-item" href={attachment.path} target="_blank" rel="noreferrer" key={attachment.id}>
                    <span>📎</span>
                    <strong>{attachment.originalName}</strong>
                    <small>{attachment.sizeBytes ? `${Math.round(attachment.sizeBytes / 1024)} KB` : 'File'}</small>
                  </a>
                ))}
              </div>
            ) : (
              <div className="expense-empty-panel">Nessun allegato caricato.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  </div>;
}
