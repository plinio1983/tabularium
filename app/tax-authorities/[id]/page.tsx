import {notFound} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireWorkspace} from '@/lib/auth';
import {detailBackHref} from '@/lib/detail-navigation';
import {taxAuthorityTotals} from '@/lib/tax-authority-totals';
import {euro} from '@/lib/money';
import DetailBackButton from '@/components/DetailBackButton';
import ExpensesList from '@/components/ExpensesList';

const kindLabels: Record<string, string> = {
  FISCAL: 'Fiscale', SOCIAL_SECURITY: 'Previdenziale', INSURANCE: 'Assicurativo',
  LOCAL: 'Ente locale', COLLECTION: 'Riscossione', OTHER: 'Altro'
};

function Field({label, value}: {label: string; value?: string | null}) {
  return <div><span>{label}</span><strong className="displayed-notes">{value?.trim() || '—'}</strong></div>;
}

export default async function TaxAuthorityDetailPage({params, searchParams}: {
  params: Promise<{id: string}>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireWorkspace('/expenses');
  const {id} = await params;
  const authorityId = Number(id);
  if (!Number.isSafeInteger(authorityId) || authorityId <= 0) notFound();
  const authority = await prisma.taxAuthority.findFirst({
    where: {id: authorityId, workspaceId: current.workspace.id},
    include: {
      defaultExpenseCategory: true,
      expenses: {
        where: {workspaceId: current.workspace.id, companyId: current.company.id},
        include: {
          category: true, taxAuthority: {select: {name: true}},
          payments: {include: {paymentMethod: true}, orderBy: {id: 'asc'}},
          attachments: true
        },
        orderBy: [{year: 'desc'}, {month: 'desc'}, {receivedDate: 'desc'}, {id: 'desc'}]
      }
    }
  });
  if (!authority) notFound();
  const query = await searchParams ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const detailHref = `/tax-authorities/${authority.id}`;
  const backHref = detailBackHref(rawReturnTo, detailHref, '/expenses');
  const listReturnTo = encodeURIComponent(`${detailHref}?returnTo=${encodeURIComponent(backHref)}`);
  const totals = taxAuthorityTotals(authority.expenses);

  return <div className="grid record-detail-page party-detail-page">
    <div className="record-detail-shell">
      <div className="record-detail-action-row record-detail-responsive-actions">
        <div className="left-side"><DetailBackButton href={backHref}/></div>
      </div>
      <article className="record-detail-document party-detail-document">
        <section className="record-detail-hero">
          <div className="record-detail-title-block">
            <p className="record-detail-kicker">Ente fiscale o previdenziale</p>
            <h1>{authority.name}</h1>
            <div className="record-detail-meta-line">
              <span>{kindLabels[authority.kind] ?? authority.kind}</span>
              <span className="badge">{authority.isActive ? 'Attivo' : 'Archiviato'}</span>
            </div>
          </div>
          <aside className="record-detail-amount-panel">
            <div className="record-detail-amount-panel-header-row">
              <span className="record-detail-amount-panel-header">Totale da pagare</span>
            </div>
            <strong className={totals.toPay > 0 ? 'text-warning' : 'text-ok'}>{euro(totals.toPay)}</strong>
            <div className="record-detail-badge-row"><span className="badge">{totals.openCount} spese da saldare</span></div>
          </aside>
        </section>
        <section className="record-detail-status-strip">
          <div><span>Totale versato</span><strong>{euro(totals.paid)}</strong></div>
          <div><span>Totale da pagare</span><strong>{euro(totals.toPay)}</strong></div>
          <div><span>Spese collegate</span><strong>{authority.expenses.length}</strong></div>
        </section>
        <section className="record-detail-section">
          <div className="record-detail-section-heading"><div><h2>Anagrafica</h2><p>Dati principali dell’ente.</p></div></div>
          <div className="record-detail-status-strip party-detail-info-strip">
            <Field label="Nome ente" value={authority.name}/>
            <Field label="Tipologia" value={kindLabels[authority.kind] ?? authority.kind}/>
            <Field label="Stato" value={authority.isActive ? 'Attivo' : 'Archiviato'}/>
            <Field label="IBAN" value={authority.iban}/>
            <Field label="Categoria predefinita" value={authority.defaultExpenseCategory?.name}/>
            <Field label="Descrizione predefinita" value={authority.defaultDescription}/>
            <Field label="Note" value={authority.notes}/>
          </div>
        </section>
      </article>
    </div>
    <div className="card record-list-card record-list-grid supplier-linked-expenses-list">
      <div className="list-heading"><div>
        <h2>Spese collegate</h2>
        <p className="muted">{current.company.name} · Tutto lo storico · {authority.expenses.length} spese</p>
      </div></div>
      <ExpensesList expenses={authority.expenses} returnTo={listReturnTo}
        timeZone={current.company.timeZone} showSupplierColumn={false}
        mobileLabel="Spese collegate all’ente"
        emptyMessage="Nessuna spesa collegata a questo ente per l’azienda selezionata."/>
    </div>
  </div>;
}
