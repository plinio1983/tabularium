import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSystemAdmin } from '@/lib/auth';
import { systemAssignWorkspacePermissionAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const roles = [
  ['OWNER', 'Proprietario'],
  ['ADMIN', 'Admin'],
  ['ACCOUNTANT', 'Contabile'],
  ['VIEWER', 'Lettore']
];

export default async function SystemWorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSystemAdmin('/admin/workspaces');
  const { id } = await params;
  const workspaceId = Number(id);
  const [workspace, users] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: true,
        members: { include: { user: true }, orderBy: { role: 'asc' } }
      }
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { email: 'asc' } })
  ]);
  if (!workspace) notFound();

  const memberUserIds = new Set(workspace.members.map(member => member.userId));
  const availableUsers = users.filter(user => !memberUserIds.has(user.id));

  return <div className="grid admin-page">
    <div className="toolbar-card">
      <div>
        <Link className="table-action secondary" href="/admin/workspaces">↩ Workspace</Link>
        <h2>{workspace.name}</h2>
        <p className="muted">Owner: {workspace.owner.email}</p>
      </div>
    </div>

    <form action={systemAssignWorkspacePermissionAction} className="card form">
      <h3>Assegna permesso</h3>
      <input type="hidden" name="workspaceId" value={workspace.id} />
      <label>Utente<select name="userId" required>
        <option value="">Seleziona utente</option>
        {availableUsers.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}
      </select></label>
      <label>Ruolo<select name="role" defaultValue="VIEWER">
        {roles.map(([role, label]) => <option key={role} value={role}>{label}</option>)}
      </select></label>
      <div className="actions-row right-actions full">
        <button className="button-standard primary-action" name="action" value="assign" type="submit">Assegna</button>
      </div>
    </form>

    <div className="card expenses-list-card">
      <div className="list-heading">
        <h3>Membri</h3>
        <p className="muted">Risultati mostrati: {workspace.members.length}</p>
      </div>
      <div className="table-scroll"><table className="expenses-table compact-expenses-table"><thead><tr>
        <th>Email</th>
        <th>Nome</th>
        <th>Ruolo</th>
        <th>Azioni</th>
      </tr></thead><tbody>
        {workspace.members.map(member => <tr key={member.id}>
          <td>{member.user.email}</td>
          <td>{member.user.name ?? '-'}</td>
          <td>
            <form id={`system-member-${member.id}`} action={systemAssignWorkspacePermissionAction}>
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="userId" value={member.userId} />
              <select name="role" defaultValue={member.role}>
                {roles.map(([role, label]) => <option key={role} value={role}>{label}</option>)}
              </select>
            </form>
          </td>
          <td className="actions-row">
            <button form={`system-member-${member.id}`} className="table-action secondary" name="action" value="assign" type="submit">Salva</button>
            <button form={`system-member-${member.id}`} className="table-action secondary" name="action" value="remove" type="submit">Rimuovi</button>
          </td>
        </tr>)}
      </tbody></table></div>
    </div>
  </div>;
}

