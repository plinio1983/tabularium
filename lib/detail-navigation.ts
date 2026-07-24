import { stripFlashParams } from '@/lib/flash';

function normalizedPathname(pathname: string) {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

export function detailBackHref(rawReturnTo: string | undefined, currentPath: string, fallback: string) {
  if (!rawReturnTo?.startsWith('/') || rawReturnTo.startsWith('//')) return fallback;

  try {
    const cleaned = stripFlashParams(rawReturnTo);
    const target = new URL(cleaned, 'http://tabularium.local');
    const current = new URL(currentPath, 'http://tabularium.local');
    if (target.origin !== current.origin) return fallback;
    if (normalizedPathname(target.pathname) === normalizedPathname(current.pathname)) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
