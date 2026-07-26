import Link from 'next/link';
import { resetPasswordAction } from '@/app/auth/actions';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  return <div className="admin-auth-page login-page">
    <section className="login-hero-panel" aria-label="Tabularium">
      <div><p className="login-kicker">Tabularium</p><h1>Nuova password</h1><p>Scegli una nuova credenziale di accesso.</p></div>
    </section>
    <section className="login-form-panel">
      <form action={resetPasswordAction} className="card form admin-auth-card">
        <div className="login-form-heading"><h2>Reimposta password</h2></div>
        {error === 'expired' ? <div className="inline-modal-error">Link non valido, scaduto o già utilizzato.</div> : null}
        {error === 'invalid' ? <div className="inline-modal-error">Le password devono coincidere e contenere almeno 10 caratteri.</div> : null}
        <input type="hidden" name="token" value={token || ''} />
        <label>Nuova password<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
        <label>Conferma password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={10} required /></label>
        <div className="actions-row right-actions login-actions">
          <Link className="btn btn-xs btn-default" href="/login">Annulla</Link>
          <button type="submit" className="btn btn-md btn-primary" disabled={!token}>Salva password</button>
        </div>
      </form>
    </section>
  </div>;
}

