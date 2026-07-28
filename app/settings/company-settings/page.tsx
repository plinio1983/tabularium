import {requireWorkspace} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {saveCompanyAction, setDefaultCompanyAction, toggleCompanyAction} from './actions';

export default async function CompanyConfigurationPage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>}) {
  const current = await requireWorkspace('/settings/company-settings');
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
  return <main className="settings-page page-no-site-header">
    <div className="toolbar-card">
      <div><h1>Società</h1><p className="muted">Gestisci le entità contabili del workspace. La società attiva determina movimenti e report visualizzati.</p></div>
    </div>
    {error ? <div className="inline-form-error">{errors[error] ?? 'Operazione non riuscita.'}</div> : null}
    <section className="card">
      <h2>Aggiungi società</h2>
      <form action={saveCompanyAction} className="form-grid">
        <label>Nome breve<input name="name" required/></label>
        <label>Codice<input name="code" placeholder="Generato dal nome"/></label>
        <label>Ragione sociale<input name="legalName"/></label>
        <label>Partita IVA<input name="vatNumber"/></label>
        <label>Codice fiscale<input name="taxCode"/></label>
        <label>PEC<input name="pec" type="email"/></label>
        <label>Codice SDI<input name="sdiCode"/></label>
        <label className="full">Indirizzo<input name="address"/></label>
        <div className="actions-row full"><button className="btn btn-primary" type="submit">＋ Aggiungi società</button></div>
      </form>
    </section>
    <section className="grid">
      {companies.map(company => <details className="card" key={company.id} open={company.id === current.company.id}>
        <summary><strong>{company.name}</strong> {company.id === current.company.id ? <span className="badge">Attiva</span> : null} {company.isDefault ? <span className="badge">Predefinita</span> : null} {!company.isActive ? <span className="badge tone-neutral">Disabilitata</span> : null}</summary>
        <form action={saveCompanyAction} className="form-grid">
          <input type="hidden" name="id" value={company.id}/>
          <label>Nome breve<input name="name" defaultValue={company.name} required/></label>
          <label>Codice<input name="code" defaultValue={company.code} required/></label>
          <label>Ragione sociale<input name="legalName" defaultValue={company.legalName ?? ''}/></label>
          <label>Partita IVA<input name="vatNumber" defaultValue={company.vatNumber ?? ''}/></label>
          <label>Codice fiscale<input name="taxCode" defaultValue={company.taxCode ?? ''}/></label>
          <label>PEC<input name="pec" defaultValue={company.pec ?? ''}/></label>
          <label>Codice SDI<input name="sdiCode" defaultValue={company.sdiCode ?? ''}/></label>
          <label className="full">Indirizzo<input name="address" defaultValue={company.address ?? ''}/></label>
          <div className="actions-row full">
            <button className="btn btn-primary" type="submit">Salva</button>
            {!company.isDefault && company.isActive ? <button className="btn btn-default" formAction={setDefaultCompanyAction} type="submit">Imposta predefinita</button> : null}
            <button className="btn btn-default" formAction={toggleCompanyAction} type="submit">{company.isActive ? 'Disabilita' : 'Riattiva'}</button>
          </div>
        </form>
      </details>)}
    </section>
  </main>;
}
