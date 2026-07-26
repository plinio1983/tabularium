import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { registerAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await getCurrentSession();
  if (current) redirect('/');
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return <div className="admin-auth-page register-page">
    <section className="login-hero-panel register-hero-panel" aria-label="Tabularium">
      <div>
        <p className="login-kicker">Tabularium</p>
        <h1>Nuovo workspace</h1>
        <p>Crea l'accesso e prepara l'ambiente operativo.</p>
      </div>
    </section>
    <section className="login-form-panel register-form-panel">
      <form action={registerAction} className="card form admin-auth-card">
        <div className="login-form-heading">
          <p className="login-kicker">Registrazione</p>
          <h2>Crea account</h2>
          <p className="muted">Imposta utente e workspace personale.</p>
        </div>
        {error === 'exists' ? <div className="inline-modal-error">Esiste già un utente con questa email.</div> : null}
        {error === 'invalid' ? <div className="inline-modal-error">Email obbligatoria e password di almeno 10 caratteri.</div> : null}
        {error === 'google_config' ? <div className="inline-modal-error">Accesso Google non configurato.</div> : null}
        {error === 'google' || error === 'google_state' ? <div className="inline-modal-error">Registrazione Google non riuscita.</div> : null}
        {error === 'rate_limited' ? <div className="inline-modal-error">Troppi tentativi. Attendi 15 minuti e riprova.</div> : null}
        <div className="register-fields-grid">
          <label>Nome<input name="name" autoComplete="name" /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
          <label>Nome workspace<input name="workspaceName" placeholder="Il mio workspace" /></label>
        </div>
        <a className="btn btn-md btn-default full login-google-button" href="/api/auth/google?next=/register/success">Registrati con Google</a>
        <div className="actions-row right-actions login-actions">
          <Link className="btn btn-xs btn-default" href="/login">Ho già un account</Link>
          <button type="submit" className="btn btn-md btn-primary">Registrati</button>
        </div>
      </form>
    </section>
  </div>;
}
