import Link from 'next/link';
import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const actionLabels: Record<string, string> = {
  CREATE: 'Creazione',
  UPDATE: 'Modifica',
  DELETE: 'Eliminazione',
  BULK_CREATE: 'Creazione multipla',
  BULK_UPDATE: 'Modifica multipla',
  BULK_DELETE: 'Eliminazione multipla',
  REVOKE_SESSIONS: 'Revoca sessioni'
};

export default async function WorkspaceAuditPage() {
  const current = await requireWorkspaceRole(workspaceManagementRoles, '/account/workspace/audit');
  const entries = await prisma.auditLog.findMany({
    where: { workspaceId: current.workspace.id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  return <div className="grid admin-page settings-admin-page workspace-settings-page">
    <div className="toolbar-card">
      <div>
        <h2>Registro attività</h2>
        <p className="muted">Ultime 200 operazioni sensibili eseguite nel workspace.</p>
      </div>
      <Link data-page-transition="backward" className="btn btn-md btn-ghost" href="/account/workspace">
        <span className="btn-icon">↩</span> Indietro
      </Link>
      {/*<Link className="btn btn-md btn-default" href="/account/workspace">↩ Indietro</Link>*/}
    </div>

    <div className="card table-wrap workspace-audit-table">
      <table>
        <thead><tr><th>Data</th><th>Utente</th><th>Operazione</th><th>Elemento</th><th>ID</th></tr></thead>
        <tbody>
          {entries.map(entry => <tr key={entry.id.toString()}>
            <td>{entry.createdAt.toLocaleString('it-IT')}</td>
            <td>{entry.user.name || entry.user.email}</td>
            <td>{actionLabels[entry.action] || entry.action}</td>
            <td>{entry.entityType}</td>
            <td>{entry.entityId || '—'}</td>
          </tr>)}
          {!entries.length ? <tr><td colSpan={5} className="muted">Nessuna attività registrata.</td></tr> : null}
        </tbody>
      </table>
    </div>
    <section className="workspace-audit-mobile-list" aria-label="Registro attività">
      {entries.map(entry => <article className="card workspace-audit-mobile-item" key={entry.id.toString()}>
        <div className="workspace-audit-mobile-heading">
          <strong>{actionLabels[entry.action] || entry.action}</strong>
          <time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toLocaleString('it-IT')}</time>
        </div>
        <p>{entry.user.name || entry.user.email}</p>
        <dl><div><dt>Elemento</dt><dd>{entry.entityType}</dd></div><div><dt>ID</dt><dd>{entry.entityId || '—'}</dd></div></dl>
      </article>)}
      {!entries.length ? <p className="card muted">Nessuna attività registrata.</p> : null}
    </section>
  </div>;
}
