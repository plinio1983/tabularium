import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSystemAdmin } from '@/lib/auth';
import { systemCreateUserAction, systemToggleUserAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function SystemUsersPage() {
  const current = await requireSystemAdmin('/admin/users');
  const users = await prisma.user.findMany({
    include: {
      ownedWorkspaces: true,
      memberships: { include: { workspace: true } }
    },
    orderBy: { email: 'asc' }
  });

  return <div className="grid admin-page">
    <div className="toolbar-card">
      <div>
        <Link className="table-action secondary" href="/admin">↩ Admin</Link>
        <h2>Utenti sistema</h2>
        <p className="muted">Vista globale riservata agli amministratori.</p>
      </div>
    </div>

    <form action={systemCreateUserAction} className="card form">
      <h3>Crea utente</h3>
      <label>Nome<input name="name" /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password temporanea<input name="password" type="password" minLength={8} required /></label>
      <label>Nome workspace<input name="workspaceName" placeholder="Workspace utente" /></label>
      <label className="toggle-field switch-toggle-field">
        <span>System admin</span>
        <span className="switch">
          <input name="isSystemAdmin" type="checkbox" />
          <span className="slider" />
          <span>Si</span>
        </span>
      </label>
      <div className="actions-row right-actions full">
        <button type="submit" className="button-standard primary-action">Crea utente</button>
      </div>
    </form>

    <div className="card expenses-list-card">
      <div className="table-scroll"><table className="expenses-table compact-expenses-table"><thead><tr>
        <th>Email</th>
        <th>Nome</th>
        <th>Stato</th>
        <th>System admin</th>
        <th>Workspace proprietario</th>
        <th>Permessi workspace</th>
        <th>Azioni</th>
      </tr></thead><tbody>
        {users.map(user => <tr key={user.id}>
          <td>{user.email}</td>
          <td>{user.name ?? '-'}</td>
          <td>{user.isActive ? 'Attivo' : 'Disattivato'}</td>
          <td>{user.isSystemAdmin ? 'Si' : 'No'}</td>
          <td>{user.ownedWorkspaces.length ? user.ownedWorkspaces.map(workspace => <div key={workspace.id}><Link href={`/admin/workspaces/${workspace.id}`}>{workspace.name}</Link></div>) : '-'}</td>
          <td>{user.memberships.length ? user.memberships.map(membership => <div key={membership.id}><Link href={`/admin/workspaces/${membership.workspaceId}`}>{membership.workspace.name}</Link> · {membership.role}</div>) : '-'}</td>
          <td className="actions-row">
            <form action={systemToggleUserAction}>
              <input type="hidden" name="userId" value={user.id} />
              <button className="table-action secondary" name="action" value={user.isActive ? 'deactivate' : 'activate'} type="submit" disabled={user.id === current.user.id}>{user.isActive ? 'Disattiva' : 'Attiva'}</button>
            </form>
            <form action={systemToggleUserAction}>
              <input type="hidden" name="userId" value={user.id} />
              <button className="table-action secondary" name="action" value={user.isSystemAdmin ? 'system_admin_off' : 'system_admin_on'} type="submit" disabled={user.id === current.user.id}>{user.isSystemAdmin ? 'Rimuovi admin' : 'Rendi admin'}</button>
            </form>
          </td>
        </tr>)}
      </tbody></table></div>
    </div>
  </div>;
}
