export type PageTransitionDirection = 'forward' | 'backward';

/** Returning to a parent (including the dashboard) reverses the slide. */
export function pageTransitionDirection(from: string, to: string): PageTransitionDirection {
  return to === '/' || from.startsWith(`${to.replace(/\/$/, '')}/`) ? 'backward' : 'forward';
}

export function shouldTransitionPage(from: string, to: string) {
  return from !== to && !to.startsWith('/api/') && to !== '/logout';
}
