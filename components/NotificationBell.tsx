'use client';

import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';

export type NotificationItem = {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  actionUrl: string | null;
  occurredAt: string;
  readAt: string | null;
  company: {id: number; name: string} | null;
};

type NotificationResponse = {unreadCount: number; notifications: NotificationItem[]};

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('it', {numeric: 'auto'});
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

export default function NotificationBell() {
  const [data, setData] = useState<NotificationResponse>({unreadCount: 0, notifications: []});
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/notifications?limit=12&company=active', {cache: 'no-store'}).catch(() => null);
    if (!response?.ok) return;
    setData(await response.json());
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 90_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility);};
  }, [load]);

  useEffect(() => {
    const close = (event: MouseEvent) => {if (!rootRef.current?.contains(event.target as Node)) setOpen(false);};
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function markRead(id: string) {
    setData(current => ({
      unreadCount: Math.max(0, current.unreadCount - (current.notifications.find(item => item.id === id)?.readAt ? 0 : 1)),
      notifications: current.notifications.map(item => item.id === id ? {...item, readAt: new Date().toISOString()} : item)
    }));
    await fetch(`/api/notifications/${id}/read`, {method: 'POST'}).catch(() => null);
  }

  async function markAllRead() {
    setData(current => ({unreadCount: 0, notifications: current.notifications.map(item => ({...item, readAt: item.readAt ?? new Date().toISOString()}))}));
    await fetch('/api/notifications/read-all', {method: 'POST'}).catch(() => null);
  }

  return <div className="notification-bell" ref={rootRef}>
    <button className="notification-bell-trigger" type="button" aria-label={`Notifiche${data.unreadCount ? `: ${data.unreadCount} non lette` : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {data.unreadCount ? <strong>{data.unreadCount > 99 ? '99+' : data.unreadCount}</strong> : null}
    </button>
    {open ? <div className="notification-popover">
      <div className="notification-popover-heading">
        <div><strong>Notifiche</strong><span>{data.unreadCount ? `${data.unreadCount} da leggere` : 'Tutto aggiornato'}</span></div>
        {data.unreadCount ? <button type="button" onClick={markAllRead}>Segna tutte lette</button> : null}
      </div>
      <div className="notification-popover-list">
        {data.notifications.map(item => <Link key={item.id} href={item.actionUrl ?? '/notifications'} onClick={() => {markRead(item.id); setOpen(false);}} className={`notification-popover-item severity-${item.severity.toLowerCase()} ${item.readAt ? 'is-read' : 'is-unread'}`}>
          <span className="notification-status-dot" aria-hidden="true" />
          <span className="notification-popover-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{item.company?.name ? `${item.company.name} · ` : ''}{relativeTime(item.occurredAt)}</small></span>
        </Link>)}
        {!data.notifications.length ? <div className="notification-empty"><span aria-hidden="true">✓</span><strong>Nessuna notifica</strong><p>Non ci sono aggiornamenti o scadenze da segnalare.</p></div> : null}
      </div>
      <Link className="notification-popover-footer" href="/notifications" onClick={() => setOpen(false)}>Vedi tutte le notifiche</Link>
    </div> : null}
  </div>;
}
