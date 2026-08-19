'use client';

import Link from 'next/link';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {NotificationItem} from '@/components/NotificationBell';

type Filter = 'all' | 'unread' | 'warning';

export default function NotificationsPageClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/notifications?limit=50', {cache: 'no-store'});
    if (response.ok) {
      const data = await response.json();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    }
    setLoading(false);
  }, []);

  useEffect(() => {load();}, [load]);
  const visible = useMemo(() => items.filter(item => {
    if (filter === 'unread') return !item.readAt;
    if (filter === 'warning') return item.severity !== 'INFO';
    return true;
  }), [items, filter]);

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    setItems(current => current.map(candidate => candidate.id === item.id ? {...candidate, readAt: new Date().toISOString()} : candidate));
    setUnreadCount(value => Math.max(0, value - 1));
    await fetch(`/api/notifications/${item.id}/read`, {method: 'POST'}).catch(() => null);
  }

  async function markAllRead() {
    setItems(current => current.map(item => ({...item, readAt: item.readAt ?? new Date().toISOString()})));
    setUnreadCount(0);
    await fetch('/api/notifications/read-all', {method: 'POST'}).catch(() => null);
  }

  return <div className="notifications-page-content">
    <div className="notification-filter-bar" role="group" aria-label="Filtra notifiche">
      <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Tutte <span>{items.length}</span></button>
      <button type="button" className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>Da leggere <span>{unreadCount}</span></button>
      <button type="button" className={filter === 'warning' ? 'is-active' : ''} onClick={() => setFilter('warning')}>Da controllare</button>
      {unreadCount ? <button type="button" className="notification-read-all" onClick={markAllRead}>Segna tutte come lette</button> : null}
    </div>
    <section className="card notifications-list" aria-live="polite">
      {visible.map(item => <Link key={item.id} href={item.actionUrl ?? '#'} onClick={() => markRead(item)} className={`notifications-list-item severity-${item.severity.toLowerCase()} ${item.readAt ? 'is-read' : 'is-unread'}`}>
        <span className="notification-list-icon" aria-hidden="true">{item.severity === 'CRITICAL' ? '!' : item.severity === 'WARNING' ? '◷' : '✓'}</span>
        <span className="notification-list-copy"><span className="notification-list-title"><strong>{item.title}</strong>{item.company ? <small>{item.company.name}</small> : null}</span><span>{item.message}</span><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('it-IT', {dateStyle: 'medium', timeStyle: 'short'})}</time></span>
        {!item.readAt ? <span className="notification-unread-label">Nuova</span> : null}
      </Link>)}
      {!loading && !visible.length ? <div className="notification-empty notification-page-empty"><span aria-hidden="true">✓</span><strong>Nessuna notifica in questa sezione</strong><p>Gli aggiornamenti di sistema appariranno qui.</p></div> : null}
      {loading ? <div className="notification-empty"><p>Caricamento notifiche…</p></div> : null}
    </section>
  </div>;
}
