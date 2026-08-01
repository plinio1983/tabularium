import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { updateWorkspaceNameAction } from './actions';
import DetailBackButton from '@/components/DetailBackButton';

export const dynamic = 'force-dynamic';

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietario',
  ADMIN: 'Admin',
  ACCOUNTANT: 'Contabile',
  VIEWER: 'Lettore'
};

const errorMessages: Record<string, string> = {
  forbidden: 'Non hai i permessi per modificare questo workspace.',
  invalid: 'Inserisci un nome workspace valido.'
};

export default async function WorkspaceAccountPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/account/workspace');
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const canEditWorkspace = current.membership.role === 'OWNER' || current.membership.role === 'ADMIN';

  return <div className="grid admin-page workspace-settings-page">
    <div className="toolbar-card">
      <div>
        <h2>Workspace</h2>
        <p className="muted">La tua area di lavoro personale.</p>
      </div>
      <DetailBackButton href="/settings" />
    </div>

    <section className="card workspace-profile-card">
      <div className="workspace-profile-icon" aria-hidden="true">▦</div>
      <div className="workspace-profile-copy">
        <span className="workspace-profile-eyebrow">Workspace attivo</span>
        <h3>{current.workspace.name}</h3>
          <span className="ml-0 badge workspace-role-badge hidden-sm-up">{roleLabels[current.membership.role] ?? current.membership.role}</span>
          <p className="muted">{current.user.email}</p>
      </div>
        <span className="badge workspace-role-badge hidden-sp">{roleLabels[current.membership.role] ?? current.membership.role}</span>
    </section>

    <section className="card workspace-account-card workspace-edit-card">
      <div className="workspace-card-heading">
        <span className="workspace-card-heading-icon" aria-hidden="true">✎</span>
        <div>
          <h3>Informazioni workspace</h3>
          <p className="muted">Modifica il nome visualizzato nell’applicazione.</p>
        </div>
      </div>
      {saved ? <div className="form-summary"><strong>Workspace aggiornato.</strong></div> : null}
      {error ? <div className="inline-form-error">{errorMessages[error] ?? 'Impossibile aggiornare il workspace.'}</div> : null}
      {canEditWorkspace ? <form action={updateWorkspaceNameAction} className="form workspace-edit-form">
        <div className="app-form-field">
          <label className="app-form-field-label" htmlFor="workspace-name">
            <span className="app-form-field-icon" aria-hidden="true">▦</span>
            <span>Nome workspace</span>
          </label>
          <input id="workspace-name" name="name" defaultValue={current.workspace.name} required maxLength={100}/>
          <small className="app-form-field-hint">Questo nome sarà visibile agli utenti che lavorano nel workspace.</small>
        </div>
        <div className="actions-row workspace-form-actions">
          <Link className="btn btn-md btn-default" href="/settings"><span className="btn-icon">×</span> Annulla</Link>
          <button type="submit" className="btn btn-md btn-primary"><span className="btn-icon">✓</span> Salva workspace</button>
        </div>
      </form> : <div className="workspace-readonly-notice">
        <span aria-hidden="true">ⓘ</span>
        <p><strong>Accesso in sola lettura</strong>Solo proprietari e amministratori possono modificare il workspace.</p>
      </div>}
    </section>

    {canEditWorkspace ? <Link className="card workspace-audit-link" href="/account/workspace/audit">
      <span className="workspace-card-heading-icon" aria-hidden="true">☷</span>
      <span>
        <strong>Registro attività</strong>
        <small>Consulta le ultime operazioni sensibili eseguite nel workspace.</small>
      </span>
      <span className="settings-main-link-arrow" aria-hidden="true">›</span>
    </Link> : null}
  </div>;
}
