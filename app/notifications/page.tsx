import Link from 'next/link';
import {requireWorkspace} from '@/lib/auth';
import NotificationsPageClient from '@/components/NotificationsPageClient';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  await requireWorkspace('/notifications');
  return <div className="grid notifications-page">
    <div className="toolbar-card notifications-toolbar">
      <div><h2>Notifiche</h2><p className="muted">Scadenze, automazioni e aggiornamenti importanti del sistema.</p></div>
      <Link className="btn btn-sm btn-default" href="/">Torna alla dashboard</Link>
    </div>
    <NotificationsPageClient />
  </div>;
}
