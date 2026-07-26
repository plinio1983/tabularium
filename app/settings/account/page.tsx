import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { revokeOtherSessionsAction, updateAccountAction } from './actions';
import AccountCancelButton from './AccountCancelButton';
import { prisma } from '@/lib/prisma';

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
    </div>

    <form action={updateAccountAction}>
      <div className="card form account-settings-form">
        <h3>Dati account</h3>
        {saved ? <div className="form-summary full"><strong>Account aggiornato.</strong></div> : null}
        {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare l’account.'}</div> : null}
        <label>Nome<input name="name" defaultValue={current.user.name ?? ''} autoComplete="name" /></label>
        <label>Email<input name="email" type="email" defaultValue={current.user.email} autoComplete="email" required /></label>
      </div>
      <div className="card form account-settings-form">
        <h3>Modifica password</h3>
        {current.user.passwordHash ? <label>Password attuale<input name="currentPassword" type="password" autoComplete="current-password" required /></label> : null}
        <label>Nuova password<input name="newPassword" type="password" autoComplete="new-password" minLength={10} /></label>
        <label>Conferma nuova password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} /></label>
      </div>
      <div className="actions-row full form-actions-row card form account-settings-form">
        <AccountCancelButton />
        <button type="submit" className="btn btn-md btn-primary">✓ Salva account</button>
      </div>
    </form>
    <div className="card form account-settings-form">
      <h3>Sessioni attive</h3>
      <p className="muted">Sessioni valide per questo account: {activeSessions}.</p>
      {sessionsRevoked !== undefined ? <div className="form-summary"><strong>Sessioni revocate: {sessionsRevoked}.</strong></div> : null}
      <form action={revokeOtherSessionsAction}>
        <button type="submit" className="btn btn-md btn-default" disabled={activeSessions <= 1}>Disconnetti gli altri dispositivi</button>
      </form>
    </div>
  </div>;
}
