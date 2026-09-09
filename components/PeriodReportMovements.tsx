import Link from 'next/link';
import {euro} from '@/lib/money';
import type {ReportMovement} from '@/lib/reports';

export default function PeriodReportMovements({kind, mode, movements, total, timeZone, returnTo}: {
  kind: 'expense' | 'income';
  mode: 'overall' | 'fiscal';
  movements: ReportMovement[];
  total: number;
  timeZone: string;
  returnTo: string;
}) {
  const expense = kind === 'expense';
  const title = mode === 'overall'
    ? expense ? 'Pagamenti del periodo' : 'Accrediti del periodo'
    : expense ? 'Costi del periodo contabile' : 'Entrate del periodo contabile';
  const dateFormat = new Intl.DateTimeFormat('it-IT', mode === 'fiscal'
    ? {month: 'short', year: 'numeric', timeZone: 'UTC'}
    : {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: expense ? 'UTC' : timeZone});

  return <section id={`report-${kind}-movements`} className="card period-report-movements">
    <h3>{title}</h3>
    <p className="muted">{mode === 'overall'
      ? 'Ogni riga rappresenta un movimento effettivo, anche parziale. Gli importi includono l’IVA quando prevista.'
      : 'Ogni riga rappresenta l’intero importo del documento, IVA inclusa quando prevista, nel periodo di fatturazione.'}</p>
    {movements.length ? <div className="period-report-movements-scroll" tabIndex={0} role="region" aria-label={title}>
      <table>
        <thead><tr>
          <th>{mode === 'overall' ? 'Data movimento' : 'Periodo contabile'}</th>
          <th>{expense ? 'Fornitore / beneficiario' : 'Cliente'}</th>
          <th>Descrizione</th>
          <th>Rilevanza fiscale</th>
          <th className="cell-right">Importo</th>
        </tr></thead>
        <tbody>{movements.map(movement => <tr key={movement.key}>
          <td>{movement.date ? dateFormat.format(movement.date) : '—'}</td>
          <td>{movement.party}</td>
          <td><Link href={`/${expense ? 'expenses' : 'incomes'}/${movement.recordId}?returnTo=${encodeURIComponent(returnTo)}`}>
            {movement.description || `${expense ? 'Spesa' : 'Incasso'} #${movement.recordId}`}
          </Link></td>
          <td>{movement.fiscal ? 'Sì' : 'No'}</td>
          <td className="cell-right">{euro(movement.amount)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th colSpan={4}>Totale</th><th className="cell-right">{euro(total)}</th></tr></tfoot>
      </table>
    </div> : <p className="muted">Nessun movimento nel periodo selezionato.</p>}
  </section>;
}
