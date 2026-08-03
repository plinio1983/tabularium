import Link from 'next/link';
import MobileSortControl from '@/components/MobileSortControl';
import { euro } from '@/lib/money';
import { badgeClass } from '@/lib/expense-ui';
import { compareDate, compareNumber, compareText } from '@/lib/mobile-sort';

const cadenceLabels: Record<string, string> = {
  MONTHLY: 'Ogni mese', EVERY_2_MONTHS: 'Ogni 2 mesi', EVERY_3_MONTHS: 'Ogni 3 mesi',
  EVERY_6_MONTHS: 'Ogni 6 mesi', YEARLY: 'Annuale', EVERY_2_YEARS: 'Ogni 2 anni'
};
const billingLabels: Record<string, string> = {
  SAME_MONTH: 'Stesso mese', NEXT_MONTH: 'Mese successivo', CUSTOM_MONTH: 'Mese impostato'
};
const months = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const cadenceStyles: Record<string, { icon: string; className: string }> = {
  MONTHLY: { icon: '↻', className: 'tone-paid' }, EVERY_2_MONTHS: { icon: '2M', className: 'tone-web' },
  EVERY_3_MONTHS: { icon: '3M', className: 'tone-installment' }, EVERY_6_MONTHS: { icon: '6M', className: 'tone-services' },
  YEARLY: { icon: '12M', className: 'tone-taxes' }, EVERY_2_YEARS: { icon: '24M', className: 'tone-neutral' }
};
const billingStyles: Record<string, { icon: string; className: string }> = {
  SAME_MONTH: { icon: 'M', className: 'tone-vat-22' }, NEXT_MONTH: { icon: '+1', className: 'tone-vat-10' },
  CUSTOM_MONTH: { icon: 'CAL', className: 'tone-vat-4' }
};
const sortOptions = [
  { value: 'active_desc', label: 'Attive prima' }, { value: 'startDate_asc', label: 'Inizio meno recente' },
  { value: 'startDate_desc', label: 'Inizio recente' }, { value: 'customer_asc', label: 'Cliente (A-Z)' },
  { value: 'customer_desc', label: 'Cliente (Z-A)' }, { value: 'description_asc', label: 'Descrizione (A-Z)' },
  { value: 'description_desc', label: 'Descrizione (Z-A)' }, { value: 'amount_desc', label: 'Importo alto' },
  { value: 'amount_asc', label: 'Importo basso' }, { value: 'cadence_asc', label: 'Cadenza (A-Z)' }
];

function dateLabel(value?: Date | string | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function creditLabel(item: any) {
  if (item.creditMonth) return `${item.creditDay ?? '-'} ${months[item.creditMonth] ?? ''}`;
  if (item.creditDay) return `Giorno ${item.creditDay}`;
  return '-';
}

export default function RecurringIncomesList({ items, filters = {} }: { items: any[]; filters?: Record<string, string | string[] | undefined> }) {
  const mobileSort = inputDefault(filters, 'mobileSort') || sortOptions[0].value;
  const mobileSortedItems = [...items].sort((a, b) => {
    switch (mobileSort) {
      case 'startDate_asc': return compareDate(a.startDate, b.startDate, 'asc');
      case 'startDate_desc': return compareDate(a.startDate, b.startDate, 'desc');
      case 'customer_asc': return compareText(a.customer?.businessName, b.customer?.businessName, 'asc');
      case 'customer_desc': return compareText(a.customer?.businessName, b.customer?.businessName, 'desc');
      case 'description_asc': return compareText(a.description, b.description, 'asc');
      case 'description_desc': return compareText(a.description, b.description, 'desc');
      case 'amount_desc': return compareNumber(a.amount, b.amount, 'desc');
      case 'amount_asc': return compareNumber(a.amount, b.amount, 'asc');
      case 'cadence_asc': return compareText(a.cadence, b.cadence, 'asc');
      default: return compareNumber(Number(a.isActive), Number(b.isActive), 'desc') || compareDate(a.startDate, b.startDate, 'asc');
    }
  });

  return <section className="card recurring-expenses-card">
    <div className="list-heading recurring-list-heading"><div><h2>Lista entrate</h2></div></div>
    <script dangerouslySetInnerHTML={{ __html: `
      document.addEventListener('click', function(event) {
        const row = event.target.closest && event.target.closest('[data-recurring-income-row]');
        if (!row || (window.matchMedia && !window.matchMedia('(min-width: 761px)').matches)) return;
        if (event.target.closest('a, button, input, select, textarea, label, summary, details')) return;
        const href = row.getAttribute('data-row-href');
        if (href) window.location.href = href;
      });
      document.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target && event.target.matches && event.target.matches('[data-recurring-income-row]') ? event.target : null;
        if (!row || (window.matchMedia && !window.matchMedia('(min-width: 761px)').matches)) return;
        event.preventDefault();
        const href = row.getAttribute('data-row-href');
        if (href) window.location.href = href;
      });
    ` }} />
    <p className="muted">Risultati mostrati: {items.length}</p>
    <MobileSortControl action="/recurring-incomes" currentValue={mobileSort} options={sortOptions} searchParams={filters} />
    {items.length ? <>
      <div className="table-scroll recurring-expenses-desktop-table-scroll">
        <table className="expenses-table compact-recurring-expenses-table">
          <thead><tr><th>Stato</th><th>Cliente</th><th>Descrizione</th><th>Canale</th><th className="cell-right">Importo</th><th>Cadenza</th><th>Accredito</th><th>Periodo fatt.</th><th>Inizio</th></tr></thead>
          <tbody>{items.map(item => {
            const status = item.archivedAt ? { icon: '⌛', label: 'Archiviata', tone: 'tone-neutral' } : item.isActive ? { icon: '✓', label: 'Attiva', tone: 'tone-yes' } : { icon: '×', label: 'Off', tone: 'tone-critical' };
            const cadence = cadenceStyles[item.cadence] ?? { icon: '↻', className: 'tone-neutral' };
            const billingStyle = billingStyles[item.billingPeriodMode] ?? { icon: 'CAL', className: 'tone-neutral' };
            const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
            return <tr key={item.id} className="clickable-desktop-row" data-recurring-income-row data-row-href={`/recurring-incomes/${item.id}/edit`} tabIndex={0}>
              <td><span className={badgeClass(status.tone)}>{status.icon} {status.label}</span></td>
              <td className="recurring-supplier-cell" title={item.customer?.businessName ?? ''}><span className="recurring-table-supplier-icon">↻</span>{item.customer?.businessName ?? 'Nessun cliente'}</td>
              <td className="recurring-description-cell" title={item.description}>{item.description}</td>
              <td><span className={badgeClass('tone-web')}>{item.salesChannel?.icon ?? '◎'} {item.salesChannel?.name ?? '-'}</span></td>
              <td className="cell-right nowrap-cell"><strong className="recurring-table-amount">{euro(item.amount.toString())}</strong></td>
              <td><span className={badgeClass(cadence.className)}>{cadence.icon} {cadenceLabels[item.cadence] ?? item.cadence}</span></td>
              <td className="nowrap-cell"><span className={badgeClass('tone-waiting')}>📅 {creditLabel(item)}</span></td>
              <td className="nowrap-cell"><span className={badgeClass(billingStyle.className)}>{billingStyle.icon} {billing}</span></td>
              <td className="nowrap-cell">{dateLabel(item.startDate)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="recurring-expenses-mobile-list" aria-label="Lista entrate ricorrenti">
        {mobileSortedItems.map(item => {
          const billing = `${billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}${item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}`;
          const credit = item.isAutomaticCredit ? `${item.paymentMethod?.icon ?? '•'} ${item.paymentMethod?.name ?? 'Automatico'}` : 'Manuale';
          return <Link className="recurring-mobile-item-shell recurring-income-mobile-item-shell recurring-mobile-item-link" href={`/recurring-incomes/${item.id}/edit`} key={item.id}>
            <article className={item.isActive ? 'recurring-mobile-item recurring-mobile-item-active' : 'recurring-mobile-item recurring-mobile-item-disabled'}>
              <div className="recurring-mobile-top"><div className="recurring-mobile-main-title"><span className={item.isActive ? 'recurring-mobile-status is-active' : 'recurring-mobile-status'}>{item.archivedAt ? 'ARCHIVIATA' : item.isActive ? 'ON' : 'OFF'}</span><span className="badge tone-insurance">{cadenceLabels[item.cadence] ?? item.cadence}</span><span className="badge">{creditLabel(item)}</span></div><strong className="recurring-mobile-amount">{euro(item.amount.toString())}</strong></div>
              <div className="recurring-mobile-top"><strong>{item.customer?.businessName ?? 'Nessun cliente'}</strong><div className="recurring-mobile-right"><strong>{credit}</strong></div></div>
              <div className="recurring-mobile-middle"><div className="recurring-mobile-description">{item.description || 'Entrata ricorrente senza descrizione'}</div><div><span className="badge">{item.salesChannel?.icon ?? '◎'} {item.salesChannel?.name ?? 'Senza canale'}</span></div></div>
              <div className="recurring-mobile-meta"><div><span>Periodo fatt.</span><strong>{billing}</strong></div><div className="recurring-mobile-meta-right"><span>{item.endDate ? 'Periodo' : 'Inizio'}</span><strong>{dateLabel(item.startDate)}{item.endDate ? ` – ${dateLabel(item.endDate)}` : ''}</strong></div></div>
            </article>
          </Link>;
        })}
      </div>
    </> : <p className="muted">Nessuna entrata ricorrente configurata.</p>}
  </section>;
}
