import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { updateAccountAction } from './actions';
import AccountCancelButton from './AccountCancelButton';

const errorMessages: Record<string, string> = {
  invalid: 'Compila email e password attuale.',
  password: 'La password attuale non è corretta.',
  password_short: 'La nuova password deve contenere almeno 8 caratteri.',
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

  return <div className="grid admin-page account-settings-page">
    <style>{`
      .account-settings-form {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .inline-form-error {
        padding: 10px 12px;
        border: 1px solid #fecaca;
        border-radius: 12px;
        background: #fef2f2;
        color: #991b1b;
        font-weight: 800;
      }

      @media (max-width: 760px) {
        .account-settings-form {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
    <div className="toolbar-card">
      <div>
        <h2>Account</h2>
        <p className="muted">Gestisci le informazioni di accesso del tuo utente.</p>
      </div>
    </div>

    <form action={updateAccountAction} className="card form account-settings-form">
      {saved ? <div className="form-summary full"><strong>Account aggiornato.</strong></div> : null}
      {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare l’account.'}</div> : null}
      <label>Nome<input name="name" defaultValue={current.user.name ?? ''} autoComplete="name" /></label>
      <label>Email<input name="email" type="email" defaultValue={current.user.email} autoComplete="email" required /></label>
      <label>Password attuale<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label>Nuova password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} /></label>
      <label>Conferma nuova password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} /></label>
      <div className="actions-row full form-actions-row">
        <AccountCancelButton />
        <button type="submit" className="button-standard primary-action">Salva account</button>
      </div>
    </form>
  </div>;
}
