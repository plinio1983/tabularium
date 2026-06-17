import { getMonthlyReport } from '@/lib/reports';
import { euro, monthName } from '@/lib/money';
import { requireWorkspace } from '@/lib/auth';

export default async function MonthPage({ params }: { params: Promise<{ year: string; month: string }> }) {
  const current = await requireWorkspace('/months');
  const resolvedParams = await params;
  const year = Number(resolvedParams.year);
  const month = Number(resolvedParams.month);
  const report = await getMonthlyReport(year, month, current.workspace.id);
  return <div className="grid">
    <div className="card">
      <h2>{monthName(month)} {year}</h2>
      <div className="grid grid-4">
        <div><div className="kpi-label">Entrate</div><div className="kpi-value">{euro(report.totals.totalRevenue)}</div></div>
        <div><div className="kpi-label">Uscite</div><div className="kpi-value">{euro(report.totals.totalExpenses)}</div></div>
        <div><div className="kpi-label">Utile lordo</div><div className="kpi-value">{euro(report.totals.grossProfit)}</div></div>
        <div><div className="kpi-label">Netto previsto</div><div className="kpi-value">{euro(report.totals.estimatedNetProfit)}</div></div>
      </div>
    </div>
    <div className="grid grid-2">
      <div className="card"><h3>IVA</h3><table><tbody>
        <tr><td>IVA vendite</td><td>{euro(report.totals.vatToPay)}</td></tr>
        <tr><td>IVA spese</td><td>{euro(report.totals.paidVat)}</td></tr>
        <tr><td>IVA da versare</td><td>{euro(report.totals.remainingVat)}</td></tr>
      </tbody></table></div>
      <div className="card"><h3>Entrate</h3><table><tbody>
        <tr><td>Web</td><td>{euro(report.totals.web)}</td></tr>
        <tr><td>Shop</td><td>{euro(report.totals.shop)}</td></tr>
        <tr><td>Incasso N.F.</td><td>{euro(report.totals.noInvoice)}</td></tr>
      </tbody></table></div>
    </div>
    <div className="card">
      <h3>Spese del mese</h3>
      <table><thead><tr><th>Data</th><th>Esercente</th><th>Categoria</th><th>Descrizione</th><th>Costo</th><th>IVA</th><th>Canale</th><th>Banca</th><th>Ditta</th><th>Dich.</th></tr></thead>
      <tbody>{report.expenses.map(e => <tr key={e.id}>
        <td>{e.receivedDate ? e.receivedDate.toLocaleDateString('it-IT') : ''}</td><td>{e.merchant}</td><td>{e.category?.code}</td><td>{e.description}</td><td>{euro(e.amount.toString())}</td><td>{Number(e.vatRate)}%</td><td>{e.channel}</td><td>{e.bank?.name}</td><td>{e.company?.code}</td><td>{e.isDeclared ? 'Si' : 'No'}</td>
      </tr>)}</tbody></table>
    </div>
  </div>;
}
