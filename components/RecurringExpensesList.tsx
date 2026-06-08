import Link from 'next/link';
import { euro } from '@/lib/money';

const cadenceLabels: Record<string, string> = { MONTHLY:'Ogni mese', EVERY_2_MONTHS:'Ogni 2 mesi', EVERY_3_MONTHS:'Ogni 3 mesi', EVERY_6_MONTHS:'Ogni 6 mesi', YEARLY:'Annuale', EVERY_2_YEARS:'Ogni 2 anni' };
const billingLabels: Record<string, string> = { SAME_MONTH:'Stesso mese', NEXT_MONTH:'Mese successivo', CUSTOM_MONTH:'Mese impostato' };
const months = ['', 'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function dateLabel(value?: Date | string | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' }).format(date);
}
function dueLabel(item: any) {
  if (item.dueMonth) return `${item.dueDay ?? '-'} ${months[item.dueMonth] ?? ''}`;
  if (item.dueDay) return `Giorno ${item.dueDay}`;
  return '-';
}

export default function RecurringExpensesList({ items }: { items: any[] }) {
  return <div className="card recurring-expenses-card">
    {items.length ? <div className="recurring-expenses-list">{items.map(item => <div className="recurring-expense-row" key={item.id}>
      <div><span className={item.isActive ? 'status-dot is-active' : 'status-dot'} /><strong>{item.description}</strong><small>{item.supplier?.businessName || item.merchant} · {item.category?.name ?? 'Senza categoria'}</small></div>
      <div><span>Cadenza</span><strong>{cadenceLabels[item.cadence] ?? item.cadence}</strong></div>
      <div><span>Scadenza</span><strong>{dueLabel(item)}</strong></div>
      <div><span>Periodo fatt.</span><strong>{billingLabels[item.billingPeriodMode] ?? item.billingPeriodMode}{item.billingMonth ? ` · ${months[item.billingMonth]}` : ''}</strong></div>
      <div><span>Pagamento</span><strong>{item.paymentChannel ?? '-'}{item.bank ? ` · ${item.bank.name}` : ''}</strong></div>
      <div><span>Inizio</span><strong>{dateLabel(item.startDate)}</strong></div>
      <div><span>Importo</span><strong>{euro(item.amount.toString())}</strong></div>
    </div>)}</div> : <p className="muted">Nessuna spesa ricorrente configurata.</p>}
  </div>;
}
