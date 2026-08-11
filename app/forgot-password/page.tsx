import Link from 'next/link';
import { forgotPasswordAction } from '@/app/auth/actions';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sent = Boolean((await searchParams)?.sent);
  return <div className="admin-auth-page login-page">
    <section className="login-hero-panel" aria-label="Tabularium">
      <div><p className="login-kicker">Tabularium</p><h1>Recupera l’accesso</h1><p>Ricevi un link monouso per impostare una nuova password.</p></div>
    </section>
    <section className="login-form-panel">
      <form action={forgotPasswordAction} className="card form admin-auth-card">
        <div className="login-form-heading"><p className="login-kicker">Sicurezza</p><h2>Password dimenticata</h2></div>
        {sent ? <div className="form-summary">Se l’indirizzo corrisponde a un account attivo, riceverai a breve un’email.</div> : null}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <div className="actions-row right-actions login-actions">
          <Link className="btn btn-sm btn-default" href="/login">Torna al login</Link>
          <button type="submit" className="btn btn-md btn-primary">Invia link</button>
        </div>
      </form>
    </section>
  </div>;
}

