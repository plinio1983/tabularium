import { notFound } from 'next/navigation';
import { requireWorkspace } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { euro } from '@/lib/money';
import { orderBanks, orderPaymentMethods } from '@/lib/workspace-defaults';
import IncomesList from '@/components/IncomesList';
import ClientEditModalController from '@/components/ClientEditModalController';
import DeleteActionButton from '@/components/DeleteActionButton';
import DetailBackButton from '@/components/DetailBackButton';
import { badgeClass, incomeCreditStatusStyles } from '@/lib/income-ui';
import { detailBackHref } from '@/lib/detail-navigation';
import { prepareIncomeList } from '@/lib/income-list';
import {incomeCreditSummary} from '@/lib/income-credits';
import {yearMonthInTimeZone} from '@/lib/company-time';
import CopyValueButton from '@/components/CopyValueButton';

function valueOrDash(value?: string | null) { return value?.trim() || '-'; }
function CopyableField({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  const display = valueOrDash(value);
  return <div className={`${className} copyable-detail-field`}><span>{label}</span><strong className={label === 'Note interne' ? 'displayed-notes' : undefined}>{display}</strong><CopyValueButton value={display === '-' ? '' : display}/></div>;
}

export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/clients');
  const id = Number((await params).id);
  const query = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const backHref = detailBackHref(rawReturnTo, `/clients/${id}`, '/clients');
  const [customer, banks, paymentMethods, salesChannels, customers] = await Promise.all([
    prisma.customer.findFirst({ where: { id, workspaceId: current.workspace.id }, include: { incomes: { where: {companyId: current.company.id}, include: { salesChannelRef: true, customer: true, paymentMethodRef: true, creditBank: true, credits: true }, orderBy: { creditDate: 'desc' } } } }),
    prisma.bank.findMany({ where: { workspaceId: current.workspace.id } }), prisma.paymentMethod.findMany({ where: { workspaceId: current.workspace.id } }),
    prisma.incomeSalesChannel.findMany({ where: { workspaceId: current.workspace.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.customer.findMany({ where: { workspaceId: current.workspace.id }, orderBy: { businessName: 'asc' } })
  ]);
  if (!customer) notFound();
  const uncredited = customer.incomes.filter(income => !income.isCredited);
  const uncreditedTotal = uncredited.reduce((sum, income) => sum + incomeCreditSummary(income).residual, 0);
  const currentYear = yearMonthInTimeZone(current.company.timeZone).year;
  const annualIncomes = customer.incomes.filter(income => income.billingYear === currentYear);
  const annualTotal = annualIncomes.reduce((sum, income) => sum + Number(income.amount), 0);
  const returnTo = encodeURIComponent(`/clients/${customer.id}`);
  const {standardIncomes: listedIncomes, cashRegisterGroups} = prepareIncomeList(customer.incomes);

  return <div className="grid record-detail-page party-detail-page">
    <ClientEditModalController />
    <div className="record-detail-shell"><article className="record-detail-document party-detail-document">
      <div className="record-detail-action-row"><div className="left-side"><DetailBackButton href={backHref} /></div>{!customer.systemRole ? <div className="right-side"><button className="btn btn-sm btn-default" type="button" data-client-edit-id={customer.id}>✎ Modifica</button><DeleteActionButton action={`/api/clients/${customer.id}`} confirmMessage="Confermi la rimozione del cliente?" className="btn btn-sm btn-danger">🗑 Elimina</DeleteActionButton></div> : <span className="badge">Cliente di sistema</span>}</div>
      <section className="record-detail-hero"><div><div className="record-detail-title-block"><p className="record-detail-kicker">Cliente #{customer.id}</p><h1>{customer.businessName}</h1><div className="record-detail-meta-line"><span>{valueOrDash(customer.alias)}</span><span className="badge">{customer.incomes.length} incassi collegati</span></div></div></div>
        <aside className="record-detail-amount-panel"><div className="record-detail-amount-panel-header-row"><span className="record-detail-amount-panel-header">Da accreditare</span></div><strong className={uncreditedTotal > 0 ? 'text-warning' : 'text-ok'}>{euro(uncreditedTotal)}</strong><div className="record-detail-badge-row"><span className={badgeClass(uncreditedTotal > 0 ? incomeCreditStatusStyles.DA_ACCREDITARE.className : incomeCreditStatusStyles.ACCREDITATO.className)}>{uncredited.length} incassi aperti</span></div></aside>
      </section>
      <section className="record-detail-status-strip"><div><span>Incassi collegati</span><strong>{customer.incomes.length}</strong></div><div><span>Da accreditare</span><strong>{uncredited.length}</strong></div><div><span>Importo da accreditare</span><strong className={uncreditedTotal > 0 ? 'text-warning' : 'text-ok'}>{euro(uncreditedTotal)}</strong></div><div><span>Incassati {currentYear}</span><strong>{euro(annualTotal)}</strong></div></section>
      <details className="record-detail-section party-detail-collapsible"><summary className="record-detail-section-heading"><div><h2>Anagrafica</h2><p>Dati principali del cliente.</p></div><span className="party-detail-collapsible-toggle" aria-hidden="true">⌄</span></summary><div className="record-detail-status-strip party-detail-info-strip">
        <CopyableField label="Ragione sociale" value={customer.businessName} /><CopyableField label="Referente" value={customer.alias} /><CopyableField label="Email" value={customer.email} /><CopyableField label="P.IVA / C.F." value={customer.vatNumber} /><CopyableField label="Cod. SDI" value={customer.taxCodeSdi} /><CopyableField label="PEC" value={customer.pec} /><CopyableField label="IBAN" value={customer.iban} /><CopyableField label="Swift" value={customer.swift} /><CopyableField label="Note interne" value={customer.internalNotes} className="span-2" />
      </div></details>
    </article></div>
    <div className="card record-list-card"><div className="list-heading"><div><h2>Incassi collegati</h2><p className="muted">Risultati mostrati: {listedIncomes.length + cashRegisterGroups.length}</p></div></div><IncomesList timeZone={current.company.timeZone} incomes={listedIncomes} cashRegisterGroups={cashRegisterGroups} returnTo={returnTo} banks={orderBanks(banks).map(bank => ({...bank, isPrimary: bank.id === current.company.primaryBankId}))} paymentMethods={orderPaymentMethods(paymentMethods, 'INCOME')} salesChannels={salesChannels} customers={customers} initialCustomerId={customer.id} hideCustomer emptyMessage="Nessun incasso collegato a questo cliente." /></div>
  </div>;
}
