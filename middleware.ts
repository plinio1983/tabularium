import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const sessionCookieName = 'tabularium_session';

const publicPrefixes = [
  '/login',
  '/register',
  '/admin/login',
  '/admin/setup',
  '/_next',
  '/icons',
  '/templates',
  '/uploads'
];

const publicPaths = new Set([
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico'
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.has(pathname) || publicPrefixes.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/api/:path*']
};
