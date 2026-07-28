import {requireWorkspaceRole, workspaceManagementRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import DetailBackButton from '@/components/DetailBackButton';
import CompanyCreatePanel from './CompanyCreatePanel';
import {saveCompanyAction, setDefaultCompanyAction, toggleCompanyAction} from './actions';

export default async function CompanyConfigurationPage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>}) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/company-settings');
  const companies = await prisma.company.findMany({
    where: {workspaceId: current.workspace.id},
    orderBy: [{isActive: 'desc'}, {isDefault: 'desc'}, {name: 'asc'}, {id: 'asc'}]
  });
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const errors: Record<string, string> = {
    invalid: 'Inserisci almeno il nome della società.',
    duplicate: 'Il codice è già utilizzato nel workspace.',
    last_active: 'Deve rimanere almeno una società attiva.',
    not_found: 'Società non trovata.'
  };
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const savedMessages: Record<string, string> = {
    '1': 'Società salvata.',
    default: 'Società predefinita aggiornata.',
    status: 'Stato della società aggiornato.'
  };
  return <div className="grid admin-page categories-settings-page company-settings-page">
    <div className="toolbar-card">
      <div><h2>Società</h2><p className="muted">Gestisci le entità contabili del workspace. La società attiva determina movimenti e report visualizzati.</p></div>
      <DetailBackButton href="/"/>
    </div>
    {saved ? <div className="form-summary full"><strong>{savedMessages[saved] ?? 'Configurazione aggiornata.'}</strong></div> : null}
    {error ? <div className="inline-form-error full">{errors[error] ?? 'Operazione non riuscita.'}</div> : null}
    <CompanyCreatePanel action={saveCompanyAction}/>
    <section className="grid company-settings-list">
      {companies.map(company => <details className="card company-settings-card payment-credit-collapsible" key={company.id} open={company.id === current.company.id}>
        <summary className="category-create-toggle">
          <span className="company-settings-summary"><strong>{company.name}</strong><span className="company-settings-badges">{company.id === current.company.id ? <span className="badge">Attiva</span> : null} {company.isDefault ? <span className="badge">Predefinita</span> : null} {!company.isActive ? <span className="badge tone-neutral">Disabilitata</span> : null}</span></span>
          <span aria-hidden="true">+</span>
        </summary>
        <form action={saveCompanyAction} className="form company-settings-form">
          <input type="hidden" name="id" value={company.id}/>
          <label>Nome breve<input name="name" defaultValue={company.name} maxLength={100} required/></label>
          <label>Codice<input name="code" defaultValue={company.code} maxLength={30} required/></label>
          <label>Ragione sociale<input name="legalName" defaultValue={company.legalName ?? ''} maxLength={160}/></label>
          <label>Partita IVA<input name="vatNumber" defaultValue={company.vatNumber ?? ''} maxLength={32}/></label>
          <label>Codice fiscale<input name="taxCode" defaultValue={company.taxCode ?? ''} maxLength={32}/></label>
          <label>PEC<input name="pec" type="email" defaultValue={company.pec ?? ''} maxLength={160}/></label>
          <label>Codice SDI<input name="sdiCode" defaultValue={company.sdiCode ?? ''} maxLength={16}/></label>
          <label className="span-2">Indirizzo<input name="address" defaultValue={company.address ?? ''} maxLength={240}/></label>
          <div className="actions-row span-2 company-settings-actions">
            {!company.isDefault && company.isActive ? <button className="btn btn-md btn-default" formAction={setDefaultCompanyAction} type="submit">Imposta predefinita</button> : null}
            <button className="btn btn-md btn-default" formAction={toggleCompanyAction} type="submit">{company.isActive ? 'Disabilita' : 'Riattiva'}</button>
            <button className="btn btn-md btn-primary" type="submit">✓ Salva</button>
          </div>
        </form>
      </details>)}
    </section>
  </div>;
}
