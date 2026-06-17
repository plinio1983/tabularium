import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { setupFirstAdminAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminSetupPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const users = await prisma.user.count();
  if (users > 0) redirect('/admin/login');
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return <div className="admin-auth-page">
    <form action={setupFirstAdminAction} className="card form admin-auth-card">
      <h2>Setup amministratore</h2>
      <p className="muted">Crea il primo utente proprietario e assegna i dati esistenti al workspace iniziale.</p>
      {error ? <div className="inline-modal-error">Email obbligatoria e password di almeno 8 caratteri.</div> : null}
      <label>Nome<input name="name" autoComplete="name" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Nome workspace<input name="workspaceName" defaultValue="Area principale" required /></label>
      <div className="actions-row right-actions">
        <button type="submit" className="button-standard primary-action">Crea amministratore</button>
      </div>
    </form>
  </div>;
}
