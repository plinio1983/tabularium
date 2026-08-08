'use client';

import { useEffect } from 'react';

function isDesktop() {
  return window.matchMedia('(min-width: 761px)').matches;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return true;
  return Boolean(target.closest('a, button, input, select, textarea, label, summary, details'));
}

export default function ClickableDesktopRows() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!isDesktop() || isInteractiveTarget(event.target)) return;

      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest<HTMLElement>('[data-row-href]');
      const href = row?.getAttribute('data-row-href');

      if (href) window.location.assign(href);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!isDesktop()) return;

      const row = event.target instanceof HTMLElement && event.target.matches('[data-row-href]')
        ? event.target
        : null;
      const href = row?.getAttribute('data-row-href');

      if (!href) return;
      event.preventDefault();
      window.location.assign(href);
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
}
