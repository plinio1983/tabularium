'use client';

import {useEffect, useLayoutEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';
import {pageTransitionDirection, shouldTransitionPage, type PageTransitionDirection} from '@/lib/page-transition';

const historyKey = 'tabulariumPageIndex';
const duration = 280;

/** Animate only route changes; query updates keep their existing local transitions. */
export default function MobilePageTransition() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const historyIndex = useRef(0);
  const historyNavigation = useRef(false);
  const pending = useRef<{path: string; direction: PageTransitionDirection; layer: HTMLElement} | null>(null);
  const animations = useRef<Animation[]>([]);
  const layer = useRef<HTMLElement | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  function enabled() {
    return window.matchMedia('(max-width: 760px)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function clear() {
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    layer.current?.remove();
    layer.current = null;
    pending.current = null;
    if (expiry.current) clearTimeout(expiry.current);
  }

  function capture(path: string, direction: PageTransitionDirection) {
    clear();
    if (!enabled() || !shouldTransitionPage(previousPath.current, path)) return;
    const content = document.querySelector<HTMLElement>('.app-content');
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const snapshot = content.cloneNode(true) as HTMLElement;
    // The copy is visual only and never participates in focus, forms or accessibility.
    snapshot.inert = true;
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.removeAttribute('id');
    snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    snapshot.querySelectorAll('script, iframe, video, audio').forEach(node => node.remove());
    const overlay = document.createElement('div');
    overlay.className = 'mobile-page-transition-snapshot';
    overlay.inert = true;
    overlay.setAttribute('aria-hidden', 'true');
    const top = Math.max(0, rect.top);
    Object.assign(overlay.style, {top: `${top}px`, left: `${rect.left}px`, width: `${rect.width}px`});
    Object.assign(snapshot.style, {position: 'absolute', top: `${rect.top - top}px`, left: '0', width: '100%', margin: '0'});
    // Isolate the old page: its classes must not trigger body:has(...) rules
    // (for example an open mobile list hiding the new page's navigation).
    const shadow = overlay.attachShadow({mode: 'closed'});
    const styles = document.createElement('style');
    styles.textContent = Array.from(document.styleSheets).map(sheet => {
      try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'); }
      catch { return ''; }
    }).join('\n');
    const shell = document.createElement('div');
    shell.className = 'shell';
    Object.assign(shell.style, {padding: '0', margin: '0'});
    shell.append(snapshot);
    shadow.append(styles, shell);
    pending.current = {path, direction, layer: overlay};
    // A cancelled navigation must not retain a detached page indefinitely.
    expiry.current = setTimeout(() => { pending.current = null; }, 10000);
  }

  useEffect(() => {
    historyIndex.current = window.history.state?.[historyKey] ?? 0;
    window.history.replaceState({...window.history.state, [historyKey]: historyIndex.current}, '');

    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || link.getAttribute('aria-disabled') === 'true') return;
      capture(url.pathname, pageTransitionDirection(previousPath.current, url.pathname));
    }

    function onPopState(event: PopStateEvent) {
      const index = event.state?.[historyKey];
      const direction = typeof index === 'number' && index > historyIndex.current ? 'forward' : 'backward';
      capture(window.location.pathname, direction);
      historyNavigation.current = previousPath.current !== window.location.pathname;
      if (typeof index === 'number') historyIndex.current = index;
    }

    function onResize() { if (!enabled()) clear(); }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('resize', onResize);
    reducedMotion.addEventListener('change', onResize);
    return () => {
      clear();
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('resize', onResize);
      reducedMotion.removeEventListener('change', onResize);
    };
  }, []);

  useLayoutEffect(() => {
    const from = previousPath.current;
    previousPath.current = pathname;
    if (from === pathname) return;
    if (!historyNavigation.current) {
      historyIndex.current += 1;
      window.history.replaceState({...window.history.state, [historyKey]: historyIndex.current}, '');
    }
    historyNavigation.current = false;
    const outgoing = pending.current;
    pending.current = null;
    if (expiry.current) clearTimeout(expiry.current);
    const content = document.querySelector<HTMLElement>('.app-content');
    if (!enabled() || !content || !shouldTransitionPage(from, pathname)) { clear(); return; }
    const direction = outgoing?.path === pathname ? outgoing.direction : pageTransitionDirection(from, pathname);
    const sign = direction === 'forward' ? 1 : -1;
    animations.current.forEach(animation => animation.cancel());
    layer.current?.remove();
    const options: KeyframeAnimationOptions = {duration, easing: 'ease', fill: 'none'};
    const incomingAnimation = content.animate([
      {transform: `translateX(${sign * 100}%)`}, {transform: 'translateX(0)'}
    ], options);
    animations.current = [incomingAnimation];
    if (outgoing?.path === pathname) {
      layer.current = outgoing.layer;
      document.body.append(outgoing.layer);
      animations.current.push(outgoing.layer.animate([
        {transform: 'translateX(0)'}, {transform: `translateX(${-sign * 100}%)`}
      ], options));
    }
    void incomingAnimation.finished.then(() => clear(), () => {});
  }, [pathname]);

  return null;
}
