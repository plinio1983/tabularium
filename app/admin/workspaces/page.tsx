import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSystemAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SystemWorkspacesPage() {
  await requireSystemAdmin('/admin/workspaces');
  const workspaces = await prisma.workspace.findMany({
    include: {
      owner: true,
      members: { include: { user: true } }
    },
    orderBy: { name: 'asc' }
  });

  return <div className="grid admin-page">
    <div className="toolbar-card">
      <div>
        <Link className="table-action secondary" href="/admin">↩ Admin</Link>
        <h2>Workspace sistema</h2>
        <p className="muted">Workspace creati dagli utenti e relativi proprietari.</p>
      </div>
    </div>

    <div className="card expenses-list-card">
      <div className="table-scroll"><table className="expenses-table compact-expenses-table"><thead><tr>
        <th>Workspace</th>
        <th>Owner</th>
        <th>Membri</th>
        <th>Azioni</th>
      </tr></thead><tbody>
        {workspaces.map(workspace => <tr key={workspace.id}>
          <td>{workspace.name}</td>
          <td>{workspace.owner.email}</td>
          <td>{workspace.members.length}</td>
          <td><Link className="table-action secondary" href={`/admin/workspaces/${workspace.id}`}>Gestisci</Link></td>
        </tr>)}
      </tbody></table></div>
    </div>
  </div>;
}

