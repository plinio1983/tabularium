import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { loginAction } from '@/app/admin/actions';
import ClearPersistedFilters from '@/components/ClearPersistedFilters';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await getCurrentSession();
  const params = (await searchParams) ?? {};
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  if (current) redirect(next && next.startsWith('/') ? next : '/');

  return <div className="admin-auth-page login-page">
    <ClearPersistedFilters />
    <section className="login-hero-panel" aria-label="Tabularium">
      <div>
        <p className="login-kicker">Tabularium</p>
        <h1>Area riservata</h1>
        <p>Accesso al workspace operativo.</p>
      </div>
    </section>
    <section className="login-form-panel">
      <form action={loginAction} className="card form admin-auth-card">
        <div className="login-form-heading">
          <p className="login-kicker">Accesso</p>
          <h2>Entra in Tabularium</h2>
          <p className="muted">Usa le credenziali del tuo account.</p>
        </div>
        {error === 'google_config' ? <div className="inline-modal-error">Accesso Google non configurato.</div> : null}
        {error === 'google' || error === 'google_state' ? <div className="inline-modal-error">Accesso Google non riuscito.</div> : null}
        {error && !String(error).startsWith('google') ? <div className="inline-modal-error">Credenziali non valide.</div> : null}
        <input type="hidden" name="next" value={next && next.startsWith('/') ? next : '/'} />
        <input type="hidden" name="failurePath" value="/login" />
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <a className="button-standard secondary-button full login-google-button" href={`/api/auth/google?next=${encodeURIComponent(next && next.startsWith('/') ? next : '/')}`}>Accedi con Google</a>
        <div className="actions-row right-actions login-actions">
          <Link className="table-action secondary" href="/register">Registrati</Link>
          <button type="submit" className="button-standard primary-action">Accedi</button>
        </div>
      </form>
    </section>
  </div>;
}
