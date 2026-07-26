import Link from 'next/link';
import { resendVerificationAction } from '@/app/auth/actions';

export const dynamic = 'force-dynamic';

export default async function ResendVerificationPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const sent = Boolean(params.sent);
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  return <div className="admin-auth-page login-page">
    <section className="login-hero-panel" aria-label="Tabularium">
      <div><p className="login-kicker">Tabularium</p><h1>Verifica email</h1><p>Richiedi un nuovo link di attivazione.</p></div>
    </section>
    <section className="login-form-panel">
      <form action={resendVerificationAction} className="card form admin-auth-card">
        <div className="login-form-heading"><h2>Invia nuovamente l’email</h2></div>
        {sent ? <div className="form-summary">Se l’account richiede la verifica, riceverai a breve un’email.</div> : null}
        <label>Email<input name="email" type="email" autoComplete="email" defaultValue={email || ''} required /></label>
        <div className="actions-row right-actions login-actions">
          <Link className="btn btn-xs btn-default" href="/login">Torna al login</Link>
          <button type="submit" className="btn btn-md btn-primary">Invia link</button>
        </div>
      </form>
    </section>
  </div>;
}

