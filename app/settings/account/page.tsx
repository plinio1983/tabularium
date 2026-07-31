import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { revokeOtherSessionsAction, updateAccountAction } from './actions';
import AccountCancelButton from './AccountCancelButton';
import { prisma } from '@/lib/prisma';
import DetailBackButton from '@/components/DetailBackButton';
import Link from 'next/link';

const errorMessages: Record<string, string> = {
  invalid: 'Compila email e password attuale.',
  password: 'La password attuale non è corretta.',
  password_short: 'La nuova password deve contenere almeno 10 caratteri.',
  password_mismatch: 'La nuova password e la conferma non coincidono.',
  email_exists: 'Esiste già un utente con questa email.'
};

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await getCurrentSession();
  if (!current) redirect('/login?next=/settings/account');
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const sessionsRevoked = Array.isArray(params.sessionsRevoked) ? params.sessionsRevoked[0] : params.sessionsRevoked;
  const activeSessions = await prisma.authSession.count({
    where: { userId: current.user.id, expiresAt: { gt: new Date() } }
  });

  return <div className="grid admin-page account-settings-page">
    <div className="toolbar-card">
      <div>
        <h2>Account</h2>
        <p className="muted">Gestisci le informazioni di accesso del tuo utente.</p>
      </div>
      <DetailBackButton href="/settings" />
    </div>

    <form action={updateAccountAction} className="card form expense-form account-settings-form account-styled-form">
      <div className="account-form-intro full">
        <span className="account-form-intro-icon" aria-hidden="true">◎</span>
        <div>
          <h3>Profilo e accesso</h3>
          <p className="muted">Aggiorna i dati personali e, se necessario, modifica la password.</p>
        </div>
      </div>
      {saved ? <div className="form-summary full"><strong>Account aggiornato.</strong></div> : null}
      {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare l’account.'}</div> : null}

      <details className="form-section full account-form-section" open>
        <summary>
          <span>Dati account</span>
          <small>Nome ed email utilizzati per il tuo profilo</small>
        </summary>
        <div className="form-section-grid account-form-section-grid">
          <div className="app-form-field">
            <label className="app-form-field-label" htmlFor="account-name">
              <span className="app-form-field-icon" aria-hidden="true">◎</span>
              <span>Nome</span>
            </label>
            <input id="account-name" name="name" defaultValue={current.user.name ?? ''} autoComplete="name" />
          </div>
          <div className="app-form-field">
            <label className="app-form-field-label" htmlFor="account-email">
              <span className="app-form-field-icon" aria-hidden="true">@</span>
              <span>Email</span>
            </label>
            <input id="account-email" name="email" type="email" defaultValue={current.user.email} autoComplete="email" required />
          </div>
        </div>
      </details>

      <div className="actions-row full form-actions-row account-form-actions">
        <AccountCancelButton />
        <button type="submit" className="btn btn-md btn-primary"><span className="btn-icon">✓</span> Salva account</button>
      </div>
    </form>
    <section className="card account-sessions-card account-password-link-card">
      <div className="account-sessions-heading">
        <span className="account-form-intro-icon" aria-hidden="true">●</span>
        <div>
          <h3>Password</h3>
          <p className="muted">{current.user.passwordHash
            ? 'Aggiorna la password usata per accedere al tuo account.'
            : 'Aggiungi una password per poter accedere anche senza Google.'}</p>
        </div>
        <Link className="btn btn-md btn-primary" href="/settings/account/password">
          <span className="btn-icon" aria-hidden="true">✦</span> Cambia password
        </Link>
      </div>
    </section>
    <section className="card account-sessions-card">
      <div className="account-sessions-heading">
        <span className="account-form-intro-icon" aria-hidden="true">⌁</span>
        <div>
          <h3>Sessioni attive</h3>
          <p className="muted">Controlla l’accesso dell’account sugli altri dispositivi.</p>
        </div>
        <span className="badge">{activeSessions} {activeSessions === 1 ? 'sessione' : 'sessioni'}</span>
      </div>
      {sessionsRevoked !== undefined ? <div className="form-summary"><strong>Sessioni revocate: {sessionsRevoked}.</strong></div> : null}
      <form action={revokeOtherSessionsAction}>
        <button type="submit" className="btn btn-md btn-default" disabled={activeSessions <= 1}>
          <span className="btn-icon" aria-hidden="true">↪</span> Disconnetti gli altri dispositivi
        </button>
      </form>
    </section>
  </div>;
}
