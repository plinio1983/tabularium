import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getCurrentSession} from '@/lib/auth';
import DetailBackButton from '@/components/DetailBackButton';
import {updatePasswordAction} from '../actions';

const errorMessages: Record<string, string> = {
  invalid: 'Inserisci la password attuale.',
  password: 'La password attuale non è corretta.',
  password_short: 'La nuova password deve contenere almeno 10 caratteri.',
  password_mismatch: 'La nuova password e la conferma non coincidono.'
};

export const dynamic = 'force-dynamic';

export default async function PasswordSettingsPage({searchParams}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await getCurrentSession();
  if (!current) redirect('/login?next=/settings/account/password');
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;

  return <div className="grid admin-page settings-admin-page account-settings-page">
    <div className="toolbar-card">
      <div>
        <h2>Cambia password</h2>
        <p className="muted">Gestisci separatamente la password di accesso.</p>
      </div>
      <DetailBackButton href="/settings/account"/>
    </div>

    <form action={updatePasswordAction} className="card form app-record-form account-settings-form account-styled-form account-password-form">
      <div className="account-form-intro full">
        <span className="account-form-intro-icon" aria-hidden="true">●</span>
        <div>
          <h3>{current.user.passwordHash ? 'Modifica password' : 'Imposta una password'}</h3>
          <p className="muted">La nuova password deve contenere almeno 10 caratteri.</p>
        </div>
      </div>
      {saved ? <div className="form-summary full"><strong>Password aggiornata. Gli altri dispositivi sono stati disconnessi.</strong></div> : null}
      {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare la password.'}</div> : null}

      <details className="form-section full account-form-section" open>
        <summary>
          <span>Credenziali di accesso</span>
          <small>Inserisci e conferma la nuova password</small>
        </summary>
        <div className="form-section-grid account-form-section-grid account-password-grid">
          {current.user.passwordHash ? <div className="app-form-field">
            <label className="app-form-field-label" htmlFor="account-current-password">
              <span className="app-form-field-icon" aria-hidden="true">●</span>
              <span>Password attuale</span>
            </label>
            <input id="account-current-password" name="currentPassword" type="password" autoComplete="current-password" required autoFocus/>
          </div> : null}
          <div className="app-form-field">
            <label className="app-form-field-label" htmlFor="account-new-password">
              <span className="app-form-field-icon" aria-hidden="true">✦</span>
              <span>Nuova password</span>
            </label>
            <input id="account-new-password" name="newPassword" type="password" autoComplete="new-password" minLength={10} required autoFocus={!current.user.passwordHash}/>
            <small className="app-form-field-hint">Minimo 10 caratteri.</small>
          </div>
          <div className="app-form-field">
            <label className="app-form-field-label" htmlFor="account-confirm-password">
              <span className="app-form-field-icon" aria-hidden="true">✓</span>
              <span>Conferma nuova password</span>
            </label>
            <input id="account-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required/>
          </div>
        </div>
      </details>

      <div className="actions-row full form-actions-row account-form-actions">
        <Link className="btn btn-md btn-default" href="/settings/account"><span className="btn-icon">×</span> Annulla</Link>
        <button type="submit" className="btn btn-md btn-primary"><span className="btn-icon">✓</span> Salva password</button>
      </div>
    </form>
  </div>;
}
