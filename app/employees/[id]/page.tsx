import {notFound} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import {detailBackHref} from '@/lib/detail-navigation';
import DetailBackButton from '@/components/DetailBackButton';
import EmployeeEditModalController from '@/components/EmployeeEditModalController';
import DeleteActionButton from '@/components/DeleteActionButton';
import CopyValueButton from '@/components/CopyValueButton';

const show = (value?: string | null) => value?.trim() || '—';
const date = (value: Date | null) => value ? new Intl.DateTimeFormat('it-IT', {dateStyle: 'long', timeZone: 'UTC'}).format(value) : '—';
function Field({label, value, copy = true}: {label: string; value: string; copy?: boolean}) { return <div className="copyable-detail-field"><span>{label}</span><strong>{value}</strong>{copy ? <CopyValueButton value={value === '—' ? '' : value}/> : null}</div>; }

export default async function EmployeeDetailPage({params, searchParams}: {params: Promise<{id: string}>; searchParams?: Promise<Record<string, string | string[] | undefined>>}) {
  const current = await requireWorkspaceRole(workspaceOperationalRoles, '/employees');
  const {id} = await params; const query = (await searchParams) ?? {}; const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const employee = await prisma.employee.findFirst({where: {id: Number(id), workspaceId: current.workspace.id, companyId: current.company.id}});
  if (!employee) notFound();
  const back = detailBackHref(rawReturnTo, `/employees/${id}`, '/employees');
  return <div className="grid record-detail-page party-detail-page employee-detail-page"><EmployeeEditModalController/><div className="record-detail-shell"><article className="record-detail-document party-detail-document">
    <div className="record-detail-action-row"><div className="left-side"><DetailBackButton href={back}/></div><div className="right-side"><button className="btn btn-sm btn-default" type="button" data-employee-edit-id={employee.id}>✎ Modifica</button><form action={`/api/employees/${employee.id}?returnTo=${encodeURIComponent(`/employees/${employee.id}`)}`} method="post"><input type="hidden" name="_action" value={employee.status === 'ACTIVE' ? 'deactivate' : 'activate'}/><button className="btn btn-sm btn-default" type="submit">{employee.status === 'ACTIVE' ? 'Disattiva' : 'Riattiva'}</button></form><DeleteActionButton action={`/api/employees/${employee.id}`} confirmMessage="Eliminare definitivamente il dipendente?" className="btn btn-sm btn-danger">🗑 Elimina</DeleteActionButton></div></div>
    <section className="record-detail-hero"><div><div className="record-detail-title-block"><p className="record-detail-kicker">Dipendente #{employee.id}</p><h1>{employee.firstName} {employee.lastName}</h1><div className="record-detail-meta-line"><span>{employee.employeeCode ? `Matricola ${employee.employeeCode}` : 'Matricola non inserita'}</span><span className={employee.status === 'ACTIVE' ? 'badge tone-ok' : 'badge tone-neutral'}>{employee.status === 'ACTIVE' ? 'Attivo' : 'Inattivo'}</span></div></div></div><aside className="record-detail-amount-panel"><span className="record-detail-amount-panel-header">Rapporto</span><strong>{employee.status === 'ACTIVE' ? 'In corso' : 'Concluso'}</strong><div className="record-detail-badge-row"><span className="badge">Dal {date(employee.hiredAt)}</span></div></aside></section>
    <section className="record-detail-status-strip"><div><span>Stato</span><strong>{employee.status === 'ACTIVE' ? 'Attivo' : 'Inattivo'}</strong></div><div><span>Assunzione</span><strong>{date(employee.hiredAt)}</strong></div><div><span>Cessazione</span><strong>{date(employee.terminatedAt)}</strong></div><div><span>IBAN</span><strong>{employee.iban ? 'Presente' : 'Mancante'}</strong></div></section>
    <details className="record-detail-section party-detail-collapsible" open><summary className="record-detail-section-heading"><div><h2>Anagrafica</h2><p>Dati personali e coordinate del dipendente.</p></div><span className="party-detail-collapsible-toggle" aria-hidden="true">⌄</span></summary><div className="record-detail-status-strip party-detail-info-strip"><Field label="Nome" value={employee.firstName}/><Field label="Cognome" value={employee.lastName}/><Field label="Matricola" value={show(employee.employeeCode)}/><Field label="Codice fiscale" value={show(employee.taxCode)}/><Field label="Email" value={show(employee.email)}/><Field label="Telefono" value={show(employee.phone)}/><Field label="IBAN" value={show(employee.iban)}/><Field label="Note interne" value={show(employee.internalNotes)}/></div></details>
  </article></div></div>;
}
