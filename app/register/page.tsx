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

  return <div className="admin-auth-page">
    <form action={registerAction} className="card form admin-auth-card">
      <h2>Registrazione</h2>
      <p className="muted">Crea il tuo utente e il tuo workspace personale.</p>
      {error === 'exists' ? <div className="inline-modal-error">Esiste già un utente con questa email.</div> : null}
      {error === 'invalid' ? <div className="inline-modal-error">Email obbligatoria e password di almeno 8 caratteri.</div> : null}
      <label>Nome<input name="name" autoComplete="name" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Nome workspace<input name="workspaceName" placeholder="Il mio workspace" /></label>
      <div className="actions-row right-actions">
        <Link className="table-action secondary" href="/login">Ho già un account</Link>
        <button type="submit" className="button-standard primary-action">Registrati</button>
      </div>
    </form>
  </div>;
}
