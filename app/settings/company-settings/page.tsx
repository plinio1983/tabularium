import {requireWorkspaceRole, workspaceManagementRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import DetailBackButton from '@/components/DetailBackButton';
import CompanyCreatePanel from './CompanyCreatePanel';
import {saveCompanyAction, setDefaultCompanyAction, toggleCompanyAction} from './actions';
import CompanyFormFields from '@/components/CompanyFormFields';

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
    invalid_timezone: 'Seleziona un fuso orario valido.',
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
      <DetailBackButton href="/settings"/>
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
        <form action={saveCompanyAction} className="form app-record-form entity-form entity-styled-form company-settings-form company-edit-form">
          <input type="hidden" name="id" value={company.id}/>
          <CompanyFormFields company={company} idPrefix={`company-${company.id}`}/>
          <div className="actions-row form-actions-row full company-settings-actions">
            {!company.isDefault && company.isActive ? <button className="btn btn-md btn-default" formAction={setDefaultCompanyAction} type="submit"><span className="btn-icon">☆</span> Imposta predefinita</button> : null}
            <button className="btn btn-md btn-default" formAction={toggleCompanyAction} type="submit"><span className="btn-icon">{company.isActive ? '○' : '●'}</span> {company.isActive ? 'Disabilita' : 'Riattiva'}</button>
            <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">✓</span> Salva modifiche</button>
          </div>
        </form>
      </details>)}
    </section>
  </div>;
}
