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
      <Link className="btn btn-md btn-default" href="/account/workspace">Torna al workspace</Link>
    </div>

    <div className="card table-wrap">
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
  </div>;
}
