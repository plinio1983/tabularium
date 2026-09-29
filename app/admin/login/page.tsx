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
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
  if (current?.user.isSystemAdmin) redirect(safeNext);

  return <div className="admin-auth-page admin-login-page">
    <aside className="admin-login-brand-panel" aria-label="Tabularium Admin">
      <div className="admin-login-brand">
        <span className="admin-login-mark" aria-hidden="true">T</span>
        <span>Tabularium</span>
      </div>
      <div className="admin-login-brand-content">
        <span className="admin-login-environment"><span aria-hidden="true" /> System Admin</span>
        <h1>Controllo centrale,<br />accesso riservato.</h1>
        <p>Gestisci utenti, workspace e configurazioni globali da un unico punto protetto.</p>
      </div>
      <p className="admin-login-brand-footer">Area amministrativa · Accesso autorizzato</p>
    </aside>

    <main className="admin-login-form-panel">
      <form action={loginAction} className="form admin-login-card">
        <div className="admin-login-card-heading">
          <span className="admin-login-lock" aria-hidden="true">⌁</span>
          <div>
            <p className="admin-login-kicker">Console amministrativa</p>
            <h2>Bentornato</h2>
            <p>Inserisci le credenziali dell’amministratore di sistema.</p>
          </div>
        </div>

        {error === 'forbidden' ? <div className="inline-modal-error admin-login-error"><strong>Accesso negato.</strong> L’utente corrente non dispone dei privilegi amministrativi.</div> : null}
        {error && error !== 'forbidden' ? <div className="inline-modal-error admin-login-error"><strong>Accesso non riuscito.</strong> Controlla email e password.</div> : null}

        <input type="hidden" name="next" value={safeNext} />
        <input type="hidden" name="failurePath" value="/admin/login" />

        <div className="admin-login-fields">
          <label>
            <span>Email amministratore</span>
            <input name="email" type="email" autoComplete="email" placeholder="nome@azienda.it" autoFocus required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" placeholder="Inserisci la password" required />
          </label>
        </div>

        <button type="submit" className="btn btn-md btn-primary admin-login-submit">
          Accedi alla console <span className="btn-icon" aria-hidden="true">→</span>
        </button>
        <p className="admin-login-security-note"><span aria-hidden="true">●</span> Connessione protetta e sessione cifrata</p>
      </form>
    </main>
  </div>;
}
