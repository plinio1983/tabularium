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
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const passwordReset = Array.isArray(params.passwordReset) ? params.passwordReset[0] : params.passwordReset;
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
        {error === 'rate_limited' ? <div className="inline-modal-error">Troppi tentativi. Attendi 15 minuti e riprova.</div> : null}
        {error === 'email_unverified' ? <div className="inline-modal-error">Verifica il tuo indirizzo email prima di accedere. <Link href={`/resend-verification?email=${encodeURIComponent(email || '')}`}>Invia un nuovo link</Link>.</div> : null}
        {error === 'verification_invalid' ? <div className="inline-modal-error">Il link di verifica non è valido, è scaduto o è già stato usato.</div> : null}
        {passwordReset ? <div className="form-summary">Password aggiornata. Ora puoi accedere.</div> : null}
        {error && !['rate_limited', 'email_unverified', 'verification_invalid'].includes(String(error)) && !String(error).startsWith('google') ? <div className="inline-modal-error">Credenziali non valide.</div> : null}
        <input type="hidden" name="next" value={next && next.startsWith('/') ? next : '/'} />
        <input type="hidden" name="failurePath" value="/login" />
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <Link href="/forgot-password" className="muted">Password dimenticata?</Link>
        <a className="btn btn-md btn-default full login-google-button" href={`/api/auth/google?next=${encodeURIComponent(next && next.startsWith('/') ? next : '/')}`}>Accedi con Google</a>
        <div className="actions-row right-actions login-actions">
          <Link className="btn btn-sm btn-default" href="/register">Registrati</Link>
          <button type="submit" className="btn btn-md btn-primary">Accedi</button>
        </div>
      </form>
    </section>
  </div>;
}
