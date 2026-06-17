import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSystemAdmin } from '@/lib/auth';
import { logoutAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const current = await requireSystemAdmin('/admin');
  const [users, workspaces] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count()
  ]);

  return <div className="grid admin-page">
    <div className="toolbar-card">
      <div>
        <h2>Amministrazione</h2>
        <p className="muted">Area globale riservata agli amministratori di sistema.</p>
      </div>
      <form action={logoutAction}>
        <button className="table-action secondary" type="submit">Logout</button>
      </form>
    </div>

    <div className="card">
      <h3>Console sistema</h3>
      <p className="muted">Utente: {current.user.email}</p>
      <p className="muted">Utenti registrati: {users}</p>
      <p className="muted">Workspace: {workspaces}</p>
      <div className="actions-row">
        <Link className="button-standard primary-action" href="/">Vai all’applicazione</Link>
        <Link className="button-standard secondary-action" href="/admin/users">Utenti</Link>
        <Link className="button-standard secondary-action" href="/admin/workspaces">Workspace</Link>
      </div>
    </div>
  </div>;
}
