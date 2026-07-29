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

  return <div className="grid admin-page">
    <div className="toolbar-card">
      <div>
        <h2>Workspace</h2>
        <p className="muted">La tua area di lavoro personale.</p>
      </div>
      <DetailBackButton href="/settings" />
    </div>

    <div className="card workspace-account-card">
      <h3>{current.workspace.name}</h3>
      <p className="muted">Utente: {current.user.email}</p>
      <p className="muted">Ruolo: {roleLabels[current.membership.role] ?? current.membership.role}</p>
    </div>
    
    <div className="card workspace-account-card">
      {saved ? <div className="form-summary"><strong>Workspace aggiornato.</strong></div> : null}
      {error ? <div className="inline-form-error">{errorMessages[error] ?? 'Impossibile aggiornare il workspace.'}</div> : null}
      {canEditWorkspace ? <form action={updateWorkspaceNameAction} className="form">
        <label>Nome workspace<input name="name" defaultValue={current.workspace.name} required /></label>
        <div className="actions-row">
          <Link className="btn btn-md btn-default" href="/"><span className="btn-icon">×</span> Annulla</Link>
          <button type="submit" className="btn btn-md btn-primary">Salva workspace</button>
        </div>
      </form> : null}
      {/*<div className="actions-row">*/}
        {/*<Link className="btn btn-md btn-primary" href="/">Vai all’applicazione</Link>*/}
      {/*</div>*/}
    </div>
  </div>;
}
