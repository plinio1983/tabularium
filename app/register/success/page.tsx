import Link from 'next/link';
import { getCurrentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RegisterSuccessPage() {
  const current = await getCurrentSession();

  return <div className="admin-auth-page">
    <section className="card form admin-auth-card">
      <h2>Registrazione completata</h2>
      <p className="muted">
        Il tuo account e il tuo workspace personale sono stati creati correttamente.
      </p>
      <div className="actions-row right-actions">
        {current ? <Link className="button-standard primary-action" href="/">Vai all'app</Link> : <Link className="button-standard primary-action" href="/login">Accedi</Link>}
      </div>
    </section>
  </div>;
}
