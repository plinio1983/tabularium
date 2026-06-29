'use client';

import { useEffect, useState } from 'react';
import { flashParamNames } from '@/lib/flash';

type FeedbackMessages = Record<string, string>;
const filterStorageKeys = [
  'dmsAccounting.expenses.filters',
  'dmsAccounting.incomes.filters',
  'dmsAccounting.suppliers.filters'
];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function stripFlashFromSearch(value: string) {
  const params = new URLSearchParams(value || '');
  flashParamNames.forEach(key => params.delete(key));
  const clean = params.toString();
  return clean ? `?${clean}` : '';
}

function removeFlashFromStoredFilters() {
  filterStorageKeys.forEach(storageKey => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { value?: unknown; savedAt?: unknown };
      if (typeof parsed.value !== 'string') return;
      const cleanValue = stripFlashFromSearch(parsed.value);
      if (cleanValue === parsed.value) return;
      if (cleanValue) window.localStorage.setItem(storageKey, JSON.stringify({ ...parsed, value: cleanValue }));
      else window.localStorage.removeItem(storageKey);
    } catch {
      const cleanValue = stripFlashFromSearch(raw);
      if (cleanValue === raw) return;
      if (cleanValue) window.localStorage.setItem(storageKey, cleanValue);
      else window.localStorage.removeItem(storageKey);
    }
  });
}

export default function ActionFeedbackBanner({
  searchParams,
  savedMessages,
  errorMessages,
  defaultSavedMessage,
  defaultErrorMessage
}: {
  searchParams: Record<string, string | string[] | undefined>;
  savedMessages?: FeedbackMessages;
  errorMessages?: FeedbackMessages;
  defaultSavedMessage?: string;
  defaultErrorMessage?: string;
}) {
  const saved = firstValue(searchParams.saved);
  const error = firstValue(searchParams.error);
  const usage = firstValue(searchParams.usage);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [saved, error, usage]);

  useEffect(() => {
    removeFlashFromStoredFilters();
    if (!saved && !error && !usage) return;
    const url = new URL(window.location.href);
    flashParamNames.forEach(key => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [saved, error, usage]);

  if (dismissed) return null;

  if (saved) {
    return <div className="action-feedback action-feedback-success full" role="status">
      <strong>{savedMessages?.[saved] ?? defaultSavedMessage ?? 'Operazione completata.'}</strong>
      <button type="button" className="action-feedback-close" aria-label="Chiudi notifica" onClick={() => setDismissed(true)}>×</button>
    </div>;
  }
  if (error) {
    return <div className="action-feedback action-feedback-error full" role="alert">
      <span>
        {errorMessages?.[error] ?? defaultErrorMessage ?? 'Operazione non completata.'}
        {error === 'in_use' && usage ? <span> Elementi collegati: {usage}.</span> : null}
      </span>
      <button type="button" className="action-feedback-close" aria-label="Chiudi notifica" onClick={() => setDismissed(true)}>×</button>
    </div>;
  }
  return null;
}
