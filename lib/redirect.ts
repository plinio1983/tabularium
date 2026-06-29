import { NextResponse } from 'next/server';

export function redirectToPath(path: string, status = 303) {
  return new NextResponse(null, {
    status,
    headers: { Location: path }
  });
}

export function pathFromUrl(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;

  try {
    const url = value.startsWith('http') ? new URL(value) : new URL(value, 'http://tabularium.local');
    if (!['http:', 'https:'].includes(url.protocol)) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : fallback;
  }
}
