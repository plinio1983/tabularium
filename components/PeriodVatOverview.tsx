import Link from 'next/link';
import {moneyTone} from '@/lib/money';

type MonthVatTotals = {
  incassoFiscale: number;
  imponibileIncassi: number;
  ivaGenerataIncassi: number;
  ivaDetraibileSpese: number;
  ivaSaldoVersato: number;
};

type MonthVatData = {year: number; month: number; totals: MonthVatTotals};

function euro(value: number) {
  return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0}).format(value);
}

function monthLabel(month: number) {
  const label = new Intl.DateTimeFormat('it-IT', {month: 'long'}).format(new Date(2026, month - 1, 1));
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function periodHref(path: '/expenses' | '/incomes', from: MonthVatData, to: MonthVatData) {
  const query = new URLSearchParams({
    billingPeriodFrom: `${from.year}-${String(from.month).padStart(2, '0')}`,
    billingPeriodTo: `${to.year}-${String(to.month).padStart(2, '0')}`
  });
  return `${path}?${query}`;
}

export default function PeriodVatOverview({months, periodType}: {months: MonthVatData[]; periodType: 'quarter' | 'year'}) {
  const sourceRows = periodType === 'quarter'
    ? months.map(item => ({
        key: `${item.year}-${item.month}`, label: monthLabel(item.month), from: item, to: item,
        fiscalIncome: item.totals.incassoFiscale, taxableIncome: item.totals.imponibileIncassi,
        generated: item.totals.ivaGenerataIncassi, deductible: item.totals.ivaDetraibileSpese,
        settled: item.totals.ivaSaldoVersato
      }))
    : [0, 1, 2, 3].map(index => {
        const quarterMonths = months.filter(item => Math.floor((item.month - 1) / 3) === index);
        return {
          key: `quarter-${index + 1}`, label: `${index + 1}° trimestre`,
          from: quarterMonths[0], to: quarterMonths[quarterMonths.length - 1],
          fiscalIncome: quarterMonths.reduce((sum, item) => sum + item.totals.incassoFiscale, 0),
          taxableIncome: quarterMonths.reduce((sum, item) => sum + item.totals.imponibileIncassi, 0),
          generated: quarterMonths.reduce((sum, item) => sum + item.totals.ivaGenerataIncassi, 0),
          deductible: quarterMonths.reduce((sum, item) => sum + item.totals.ivaDetraibileSpese, 0),
          settled: quarterMonths.reduce((sum, item) => sum + item.totals.ivaSaldoVersato, 0)
        };
      }).filter((row): row is typeof row & {from: MonthVatData; to: MonthVatData} => Boolean(row.from && row.to));

  let runningBalance = 0;
  const rows = sourceRows.map(row => {
    const balance = row.generated - row.deductible - row.settled;
    runningBalance += balance;
    return {...row, balance, progressive: runningBalance};
  });
  const totals = rows.reduce((result, row) => ({
    fiscalIncome: result.fiscalIncome + row.fiscalIncome,
    taxableIncome: result.taxableIncome + row.taxableIncome,
    generated: result.generated + row.generated,
    deductible: result.deductible + row.deductible,
    settled: result.settled + row.settled
  }), {fiscalIncome: 0, taxableIncome: 0, generated: 0, deductible: 0, settled: 0});
  const balance = totals.generated - totals.deductible - totals.settled;
  const effectiveRate = totals.fiscalIncome ? totals.generated / totals.fiscalIncome * 100 : 0;
  const periodLabel = periodType === 'quarter' ? 'trimestre selezionato' : 'anno selezionato';

  return <section id="iva" className="card report-vat-statement">
    <header className="report-vat-statement-heading">
      <div><span className="report-vat-eyebrow">Prospetto fiscale</span><h2>Situazione IVA</h2><p className="muted">Movimenti di competenza del {periodLabel}.</p></div>
      <div className={`report-vat-balance ${balance > 0 ? 'is-debit' : balance < 0 ? 'is-credit' : ''}`}>
        <span>{balance > 0 ? 'Saldo a debito' : balance < 0 ? 'Saldo a credito' : 'Saldo in equilibrio'}</span><strong>{euro(balance)}</strong>
      </div>
    </header>

    <div className="report-vat-foundation">
      <div><span>Incassi fiscali</span><strong>{euro(totals.fiscalIncome)}</strong><small>Importi IVA inclusa</small></div>
      <div><span>Imponibile</span><strong>{euro(totals.taxableIncome)}</strong><small>Incassi fiscali al netto dell’IVA</small></div>
      <div><span>Aliquota effettiva</span><strong>{effectiveRate.toFixed(1).replace('.', ',')}%</strong><small>IVA generata sugli incassi fiscali</small></div>
    </div>

    <div className="report-vat-equation" aria-label={`IVA generata ${euro(totals.generated)}, meno IVA detraibile ${euro(totals.deductible)}, meno IVA liquidata ${euro(totals.settled)}, uguale saldo ${euro(balance)}`}>
      <div className="is-generated"><span>IVA generata</span><strong>{euro(totals.generated)}</strong></div><b aria-hidden="true">−</b>
      <div className="is-deductible"><span>IVA detraibile</span><strong>{euro(totals.deductible)}</strong></div><b aria-hidden="true">−</b>
      <div className="is-settled"><span>IVA già liquidata</span><strong>{euro(totals.settled)}</strong></div><b aria-hidden="true">=</b>
      <div className="is-balance"><span>Saldo stimato</span><strong className={moneyTone(balance)}>{euro(balance)}</strong></div>
    </div>

    <div className="report-vat-periods-heading"><h3>Dettaglio per {periodType === 'quarter' ? 'mese' : 'trimestre'}</h3><p className="muted">Composizione del saldo e progressivo nel periodo selezionato.</p></div>
    <div className="report-vat-period-list" role="list">
      {rows.map(row => <article className="report-vat-period" role="listitem" key={row.key}>
        <header>
          <div><span>Periodo</span><h4>{row.label}</h4></div>
          <div className={moneyTone(row.balance, 'report-vat-period-balance')}><span>{row.balance > 0 ? 'A debito' : row.balance < 0 ? 'A credito' : 'In equilibrio'}</span><strong>{euro(row.balance)}</strong></div>
        </header>
        <div className="report-vat-period-values">
          <div><span>Incassi fiscali</span><strong>{euro(row.fiscalIncome)}</strong></div>
          <div><span>Imponibile</span><strong>{euro(row.taxableIncome)}</strong></div>
          <div className="is-generated"><span>IVA generata</span><strong>{euro(row.generated)}</strong></div>
          <div className="is-deductible"><span>IVA detraibile</span><strong>{euro(row.deductible)}</strong></div>
          <div className="is-settled"><span>IVA liquidata</span><strong>{euro(row.settled)}</strong></div>
        </div>
        <footer>
          <nav aria-label={`Movimenti ${row.label}`}><Link href={periodHref('/incomes', row.from, row.to)}>Vedi incassi</Link><Link href={periodHref('/expenses', row.from, row.to)}>Vedi spese</Link></nav>
          <div><span>Progressivo</span><strong className={moneyTone(row.progressive)}>{euro(row.progressive)}</strong></div>
        </footer>
      </article>)}
    </div>
    <p className="muted report-vat-note">Il progressivo considera soltanto i movimenti del periodo selezionato e non eventuali crediti IVA provenienti da periodi precedenti.</p>
  </section>;
}
