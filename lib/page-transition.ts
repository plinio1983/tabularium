export type PageTransitionDirection = 'forward' | 'backward';

/** Returning to a parent (including the dashboard) reverses the slide. */
export function pageTransitionDirection(from: string, to: string): PageTransitionDirection {
  return to === '/' || from.startsWith(`${to}?section=`) || from.startsWith(`${to.replace(/\/$/, '')}/`) ? 'backward' : 'forward';
}

export function shouldTransitionPage(from: string, to: string) {
  // Period and mode changes stay within the same report workspace.
  if (/^\/months\/\d+\/\d+$/.test(from) && /^\/months\/\d+\/\d+$/.test(to)) return false;
  return from !== to && !to.startsWith('/api/') && to !== '/logout';
}

/** Settings sections are pages; other query parameters remain local updates. */
export function pageTransitionKey(pathname: string, params: {get: (name: string) => string | null}) {
  const section = params.get('section');
  return pathname === '/settings/payment-credit' && ['banks', 'methods', 'routing'].includes(section ?? '')
    ? `${pathname}?section=${section}` : pathname;
}

export const pageReturnEvent = 'app-page-return';
/** Prepare the usual backward slide before a programmatic return. */
export function preparePageReturn(href: string) {
  window.dispatchEvent(new CustomEvent(pageReturnEvent, {detail: {href}}));
}
