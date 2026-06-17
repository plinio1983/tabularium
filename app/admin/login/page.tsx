import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';
import { loginAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const users = await prisma.user.count();
  if (users === 0) redirect('/admin/setup');

  const current = await getCurrentSession();
  const params = (await searchParams) ?? {};
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  if (current) redirect(next && next.startsWith('/') ? next : '/');

  return <div className="admin-auth-page">
    <form action={loginAction} className="card form admin-auth-card">
      <h2>Login amministrazione</h2>
      <p className="muted">Accedi alla tua area di lavoro Tabularium.</p>
      {error ? <div className="inline-modal-error">Credenziali non valide.</div> : null}
      <input type="hidden" name="next" value={next && next.startsWith('/') ? next : '/'} />
      <input type="hidden" name="failurePath" value="/admin/login" />
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <div className="actions-row right-actions">
        <button type="submit" className="button-standard primary-action">Accedi</button>
      </div>
    </form>
  </div>;
}
