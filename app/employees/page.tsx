import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {requireWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import NewEmployeePanel from '@/components/NewEmployeePanel';
import EmployeeEditModalController from '@/components/EmployeeEditModalController';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import MobileSortControl from '@/components/MobileSortControl';
import {stripFlashRecord} from '@/lib/flash';
import EmployeeFiltersDrawer from '@/components/EmployeeFiltersDrawer';
import SearchIcon from '@/components/SearchIcon';
import BulkSelectionController from '@/components/BulkSelectionController';
import ClickableDesktopRows from '@/components/ClickableDesktopRows';

const sortOptions = [
  {value: 'name_asc', label: 'Cognome (A-Z)'}, {value: 'name_desc', label: 'Cognome (Z-A)'},
  {value: 'hired_desc', label: 'Assunzione più recente'}, {value: 'hired_asc', label: 'Assunzione meno recente'}
];
const text = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
const date = (value: Date | null) => value ? new Intl.DateTimeFormat('it-IT', {dateStyle: 'medium', timeZone: 'UTC'}).format(value) : '—';
const filterKeys = ['firstName', 'lastName', 'employeeCode', 'taxCode', 'email', 'phone', 'iban', 'status', 'hiredFrom', 'hiredTo', 'terminatedFrom', 'terminatedTo'] as const;
const filterDate = (value: string, end = false) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`) : undefined;

export default async function EmployeesPage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>}) {
  const current = await requireWorkspaceRole(workspaceOperationalRoles, '/employees');
  const raw = (await searchParams) ?? {};
  const filters = stripFlashRecord(raw);
  const search = text(filters.search).trim();
  const status = text(filters.status);
  const firstName = text(filters.firstName).trim();
  const lastName = text(filters.lastName).trim();
  const employeeCode = text(filters.employeeCode).trim();
  const taxCode = text(filters.taxCode).trim();
  const email = text(filters.email).trim();
  const phone = text(filters.phone).trim();
  const iban = text(filters.iban).trim();
  const hiredFrom = text(filters.hiredFrom);
  const hiredTo = text(filters.hiredTo);
  const terminatedFrom = text(filters.terminatedFrom);
  const terminatedTo = text(filters.terminatedTo);
  const sort = text(filters.mobileSort) || 'name_asc';
  const employees = await prisma.employee.findMany({
    where: {workspaceId: current.workspace.id, companyId: current.company.id,
      ...(status === 'ACTIVE' || status === 'INACTIVE' ? {status} : {}),
      ...(firstName ? {firstName: {contains: firstName, mode: 'insensitive'}} : {}),
      ...(lastName ? {lastName: {contains: lastName, mode: 'insensitive'}} : {}),
      ...(employeeCode ? {employeeCode: {contains: employeeCode, mode: 'insensitive'}} : {}),
      ...(taxCode ? {taxCode: {contains: taxCode, mode: 'insensitive'}} : {}),
      ...(email ? {email: {contains: email, mode: 'insensitive'}} : {}),
      ...(phone ? {phone: {contains: phone, mode: 'insensitive'}} : {}),
      ...(iban ? {iban: {contains: iban, mode: 'insensitive'}} : {}),
      ...(hiredFrom || hiredTo ? {hiredAt: {...filterDate(hiredFrom) && {gte: filterDate(hiredFrom)}, ...filterDate(hiredTo, true) && {lte: filterDate(hiredTo, true)}}} : {}),
      ...(terminatedFrom || terminatedTo ? {terminatedAt: {...filterDate(terminatedFrom) && {gte: filterDate(terminatedFrom)}, ...filterDate(terminatedTo, true) && {lte: filterDate(terminatedTo, true)}}} : {}),
      ...(search ? {OR: [{firstName: {contains: search, mode: 'insensitive'}}, {lastName: {contains: search, mode: 'insensitive'}}, {employeeCode: {contains: search, mode: 'insensitive'}}, {taxCode: {contains: search, mode: 'insensitive'}}]} : {})},
    orderBy: [{lastName: 'asc'}, {firstName: 'asc'}]
  });
  employees.sort((a, b) => {
    if (sort === 'name_desc') return `${b.lastName} ${b.firstName}`.localeCompare(`${a.lastName} ${a.firstName}`, 'it');
    if (sort === 'hired_desc') return (b.hiredAt?.getTime() ?? 0) - (a.hiredAt?.getTime() ?? 0);
    if (sort === 'hired_asc') return (a.hiredAt?.getTime() ?? 0) - (b.hiredAt?.getTime() ?? 0);
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'it');
  });
  const currentQuery = new URLSearchParams();
  if (search) currentQuery.set('search', search);
  filterKeys.forEach(key => { const item = text(filters[key]); if (item) currentQuery.set(key, item); });
  const returnTo = `/employees${currentQuery.size ? `?${currentQuery}` : ''}`;
  const activeFilters = [
    search && {label: 'Ricerca', value: search}, firstName && {label: 'Nome', value: firstName}, lastName && {label: 'Cognome', value: lastName},
    employeeCode && {label: 'Matricola', value: employeeCode}, taxCode && {label: 'Codice fiscale', value: taxCode}, email && {label: 'Email', value: email},
    phone && {label: 'Telefono', value: phone}, iban && {label: 'IBAN', value: iban}, status && {label: 'Stato', value: status === 'ACTIVE' ? 'Attivo' : 'Inattivo'},
    hiredFrom && {label: 'Assunzione da', value: hiredFrom}, hiredTo && {label: 'Assunzione a', value: hiredTo},
    terminatedFrom && {label: 'Cessazione da', value: terminatedFrom}, terminatedTo && {label: 'Cessazione a', value: terminatedTo}
  ].filter(Boolean) as Array<{label: string; value: string}>;
  return <div className="grid employees-page">
    <EmployeeEditModalController/><ClickableDesktopRows/><BulkSelectionController/>
    <div className="toolbar-card toolbar-card-wrap">
      <div><h2>Dipendenti</h2><p className="muted">Anagrafiche dell’azienda {current.company.name}.</p></div>
      <div className="toolbar-actions"><NewEmployeePanel initialOpen={text(raw.new) === '1'}/></div>
    </div>
    <ActionFeedbackBanner searchParams={raw} savedMessages={{created: 'Dipendente creato.', updated: 'Dipendente aggiornato.', deleted: 'Dipendente eliminato.', bulk_deleted: 'Dipendenti eliminati.', activated: 'Dipendente riattivato.', deactivated: 'Dipendente disattivato.'}} errorMessages={{invalid: 'Controlla i dati inseriti.', not_found: 'Dipendente non trovato.', duplicate_code: 'La matricola è già utilizzata.'}} defaultSavedMessage="Operazione completata." defaultErrorMessage="Impossibile completare l’operazione."/>
    <div className="card record-list-card fixed">
      <div className="list-heading recurring-list-heading"><div><h2>Lista dipendenti</h2><p className="muted">Risultati mostrati: {employees.length}</p></div><div><EmployeeFiltersDrawer filters={filters}/></div></div>
      <form className="entity-quick-search app-quick-search-form" action="/employees" method="get" role="search">
        {filterKeys.map(key => text(filters[key]) ? <input type="hidden" name={key} value={text(filters[key])} key={key}/> : null)}
        <label className="app-form-field-label" htmlFor="employeeSearch"><span className="app-form-field-icon" aria-hidden="true">⌕</span><span>Ricerca dipendente</span></label>
        <div className="entity-quick-search-field app-quick-search-field input-group">
          <input id="employeeSearch" name="search" defaultValue={search} placeholder="Nome, matricola o codice fiscale" autoComplete="off"/>
          <button className="btn btn-sm btn-main" type="submit" aria-label="Cerca dipendente"><SearchIcon/></button>
        </div>
      </form>
      <MobileSortControl action="/employees" currentValue={sort} options={sortOptions} searchParams={filters}/>
      {activeFilters.length ? <div className="recurring-active-filters"><div><span className="recurring-active-filters-title">Filtri attivi</span><div className="recurring-active-filter-tags">{activeFilters.map(item => <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}</div></div><Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/employees">× Reset</Link></div> : null}
      <form id="employeeBulkForm" action={`/api/employees/bulk?returnTo=${encodeURIComponent(returnTo)}`} method="post" className="bulk-actions-bar grouped-bulk-actions-bar party-bulk-actions-bar confirm-bulk-form" data-bulk-button-group="true">
        <label className="bulk-select-all-inline"><input type="checkbox" className="bulk-select-all" data-bulk-target="employeeBulkForm" aria-label="Seleziona tutti i dipendenti visibili"/></label>
        <div className="bulk-action-buttons btn-group">
          <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form="employeeBulkForm"><summary className="bulk-action-trigger"><span className="btn-icon hidden-mobile">⚙</span><span className="hidden-sm-up">Actions</span><span className="hidden-sm-down">Bulk actions</span></summary><div className="bulk-action-menu-panel"><button className="btn btn-sm btn-default danger-menu-item bulk-menu-mobile-delete" type="submit" name="bulkAction" value="delete"><span className="btn-icon">🗑</span><span className="hidden-sm-down">Rimuovi selezionati</span></button></div></details>
          <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="employeeBulkForm" data-edit-trigger-attr="data-employee-edit-id"><a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="hidden-sm-down">Modifica</span></a><button type="submit" className="bulk-direct-link bulk-direct-danger hidden-xs-down" name="bulkAction" value="delete" data-bulk-delete disabled><span className="btn-icon icon-small">🗑</span><span className="hidden-sm-down">Elimina</span></button></div>
        </div>
        <div className="bulk-inner-container"><button className="bulk-direct-link btn btn-md bulk-add-link btn-primary" type="button" data-bulk-new data-employee-new data-floating-label="Dipendente"><span className="btn-icon">+</span><span className="hidden-sm-down">Dipendente</span></button></div>
      </form>
      <div className="table-scroll"><table className="table compact-table"><thead><tr><th className="cell-center"><input type="checkbox" className="bulk-select-all" data-bulk-target="employeeBulkForm" aria-label="Seleziona tutti i dipendenti"/></th><th>Dipendente</th><th>Matricola</th><th>Codice fiscale</th><th>Assunzione</th><th>Cessazione</th><th>Stato</th></tr></thead><tbody>{employees.map(employee => <tr key={employee.id} className={`clickable-desktop-row${employee.status === 'INACTIVE' ? ' row-muted' : ''}`} data-row-href={`/employees/${employee.id}?returnTo=${encodeURIComponent(returnTo)}`} tabIndex={0}><td className="cell-center"><input form="employeeBulkForm" className="bulk-select-all" type="checkbox" name="ids" value={employee.id} aria-label={`Seleziona dipendente ${employee.lastName} ${employee.firstName}`}/></td><td><strong>{employee.lastName} {employee.firstName}</strong>{employee.email ? <><br/><small className="muted">{employee.email}</small></> : null}</td><td>{employee.employeeCode ?? '—'}</td><td>{employee.taxCode ?? '—'}</td><td>{date(employee.hiredAt)}</td><td>{date(employee.terminatedAt)}</td><td><span className={employee.status === 'ACTIVE' ? 'badge tone-ok' : 'badge tone-neutral'}>{employee.status === 'ACTIVE' ? 'Attivo' : 'Inattivo'}</span></td></tr>)}</tbody></table></div>
      <div className="party-mobile-list mobile-record-list">{employees.map(employee => <article className="party-mobile-item mobile-record-item" key={employee.id}><div className="mobile-record-select"><input form="employeeBulkForm" type="checkbox" name="ids" value={employee.id} aria-label={`Seleziona dipendente ${employee.lastName} ${employee.firstName}`}/></div><Link className="mobile-record-link party-mobile-link" href={`/employees/${employee.id}?returnTo=${encodeURIComponent(returnTo)}`}><div className="mobile-record-main"><div className="mobile-record-title-row"><div className="mobile-record-title-left"><strong>{employee.lastName} {employee.firstName}</strong></div><div className="mobile-record-title-right"><span className={employee.status === 'ACTIVE' ? 'badge tone-ok' : 'badge tone-neutral'}>{employee.status === 'ACTIVE' ? 'Attivo' : 'Inattivo'}</span></div></div><div className="mobile-record-subtitle"><span>{employee.employeeCode || 'Nessuna matricola'}</span><span>{employee.taxCode || 'C.F. non inserito'}</span></div><div className="mobile-record-meta"><span>Assunto: {date(employee.hiredAt)}</span>{employee.email ? <span>{employee.email}</span> : null}</div></div></Link></article>)}</div>
      {!employees.length ? <p className="muted empty-state">Nessun dipendente trovato.</p> : null}
    </div>
  </div>;
}
