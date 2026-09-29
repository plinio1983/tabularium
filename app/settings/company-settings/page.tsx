import InfoHint from '@/components/InfoHint';
import {requireWorkspaceRole, workspaceManagementRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import DetailBackButton from '@/components/DetailBackButton';
import CompanyCreatePanel from './CompanyCreatePanel';
import CompanyDeleteForm from './CompanyDeleteForm';
import {companyUsageSelect, companyUsageSummary, companyUsageLabels, type CompanyUsage} from '@/lib/company-usage';
import {deleteCompanyAction, saveCompanyAction, setDefaultCompanyAction, toggleCompanyAction} from './actions';

export default async function CompanyConfigurationPage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>}) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/company-settings');
  const companies = await prisma.company.findMany({
    where: {workspaceId: current.workspace.id},
    include: {_count: {select: companyUsageSelect}},
    orderBy: [{isActive: 'desc'}, {isDefault: 'desc'}, {name: 'asc'}, {id: 'asc'}]
  });
  const activeCount = companies.filter(company => company.isActive).length;
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const errors: Record<string, string> = {
    invalid: 'Inserisci almeno il nome della società.',
    invalid_timezone: 'Seleziona un fuso orario valido.',
    duplicate: 'Il codice è già utilizzato nel workspace.',
    last_active: 'Deve rimanere almeno una società abilitata.',
    in_use: 'Eliminazione bloccata: la società contiene dati collegati. Consulta il riepilogo aggiornato; puoi disabilitarla per conservare lo storico.',
    conflict: 'La configurazione è stata modificata contemporaneamente. Riprova.',
    not_found: 'Società non trovata.'
  };
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const savedMessages: Record<string, string> = {
    '1': 'Società salvata.',
    default: 'Società predefinita aggiornata.',
    status: 'Stato della società aggiornato.',
    deleted: 'Società eliminata.'
  };
  return <div className="grid admin-page settings-admin-page categories-settings-page company-settings-page">
    <div className="toolbar-card">
      <div><h2>Società</h2><p className="muted">Gestisci le entità contabili del workspace. La società in uso determina movimenti e report visualizzati.</p></div>
      <div className="settings-hub-toolbar-actions">
        <DetailBackButton href="/settings"/>
        <CompanyCreatePanel action={saveCompanyAction}/>
      </div>
    </div>
    {saved ? <div className="form-summary full"><strong>{savedMessages[saved] ?? 'Configurazione aggiornata.'}</strong></div> : null}
    {error ? <div className="inline-form-error full">{errors[error] ?? 'Operazione non riuscita.'}</div> : null}
    <div className="company-help"><span>Informazioni sulle società</span><InfoHint compactOnly title="Società">Gestisci le entità contabili del workspace. La società in uso determina movimenti e report visualizzati.</InfoHint></div>
    <section className="grid company-settings-list">
      {companies.map(company => <article className="card company-settings-card" key={company.id}>
        <div className="company-settings-heading">
          <span className="company-settings-summary"><strong>{company.name}</strong><span className="company-settings-badges">{company.id === current.company.id ? <span className="badge">In uso</span> : null} {company.isDefault ? <span className="badge">Predefinita</span> : null} <span className={company.isActive ? 'badge tone-ok' : 'badge tone-neutral'}>{company.isActive ? 'Abilitata' : 'Disabilitata'}</span></span></span>
        </div>
        <section className="company-settings-usage" aria-label="Dati collegati">
          <h3>Dati collegati</h3>
          {companyUsageSummary(company._count) ? <dl className="company-usage-grid">
            {(Object.keys(companyUsageLabels) as Array<keyof CompanyUsage>).filter(key => company._count[key] > 0).map(key =>
              <div className="company-usage-item" key={key}>
                <dt>{companyUsageLabels[key]}</dt>
                <dd>{company._count[key].toLocaleString('it-IT')}</dd>
              </div>
            )}
          </dl> : <p className="muted">Nessun dato collegato.</p>}
        </section>
        <dl className="company-settings-details">
          {[
            ['Codice', company.code], ['Ragione sociale', company.legalName],
            ['Partita IVA', company.vatNumber], ['Codice fiscale', company.taxCode],
            ['PEC', company.pec], ['Codice SDI', company.sdiCode],
            ['Indirizzo', company.address], ['Fuso orario', company.timeZone],
          ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <div className="company-card-actions">
          <CompanyCreatePanel action={saveCompanyAction} company={{id: company.id, name: company.name, code: company.code, legalName: company.legalName, vatNumber: company.vatNumber, taxCode: company.taxCode, pec: company.pec, sdiCode: company.sdiCode, address: company.address, timeZone: company.timeZone}}/>
          <form action={toggleCompanyAction}>
            <input type="hidden" name="id" value={company.id}/>
            <button className="btn btn-md btn-default" type="submit" disabled={company.isActive && activeCount <= 1}><span className="btn-icon">{company.isActive ? '○' : '●'}</span> {company.isActive ? 'Disabilita' : 'Abilita'}</button>
          </form>
          {!company.isDefault && company.isActive ? <form action={setDefaultCompanyAction}>
            <input type="hidden" name="id" value={company.id}/>
            <button className="btn btn-md btn-default" type="submit"><span className="btn-icon">☆</span> Imposta predefinita</button>
          </form> : null}
        </div>
        <CompanyDeleteForm id={company.id} name={company.name} action={deleteCompanyAction}
          blockedReason={company.isActive && activeCount <= 1
            ? 'Non puoi eliminare l’ultima società abilitata.'
            : companyUsageSummary(company._count)
              ? `Eliminazione bloccata: ${companyUsageSummary(company._count)}. Puoi disabilitare la società per conservare lo storico.`
              : undefined}/>
      </article>)}
    </section>
  </div>;
}
