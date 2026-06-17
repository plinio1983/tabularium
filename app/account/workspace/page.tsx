import Link from 'next/link';
import { requireWorkspace } from '@/lib/auth';
import { updateWorkspaceNameAction } from './actions';

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
    <style>{`
      .workspace-account-card {
        display: grid;
        gap: 16px;
      }

      .workspace-account-card .form {
        width: min(720px, 100%);
      }

      .inline-form-error {
        padding: 10px 12px;
        border: 1px solid #fecaca;
        border-radius: 12px;
        background: #fef2f2;
        color: #991b1b;
        font-weight: 800;
      }
    `}</style>
    <div className="toolbar-card">
      <div>
        <h2>Workspace</h2>
        <p className="muted">La tua area di lavoro personale.</p>
      </div>
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
          <Link className="secondary-button button-standard" href="/">× Annulla</Link>
          <button type="submit" className="button-standard primary-action">Salva workspace</button>
        </div>
      </form> : null}
      {/*<div className="actions-row">*/}
        {/*<Link className="button-standard primary-action" href="/">Vai all’applicazione</Link>*/}
      {/*</div>*/}
    </div>
  </div>;
}
