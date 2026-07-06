import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const sessionCookieName = 'tabularium_session';

const publicPrefixes = [
  '/login',
  '/register',
  '/api/auth',
  '/api/cron',
  '/api/jobs',
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

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.append('Vary', 'Cookie');
  return response;
}

function cleanNextPath(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.searchParams.delete('_rsc');
  url.searchParams.delete('__flight__');
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ''}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.has(pathname) || publicPrefixes.some(prefix => pathname.startsWith(prefix))) {
    return noStore(NextResponse.next());
  }

  const hasSession = Boolean(request.cookies.get(sessionCookieName)?.value);
  if (hasSession) return noStore(NextResponse.next());

  if (pathname.startsWith('/api')) {
    return noStore(NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 }));
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', cleanNextPath(request));
  return noStore(new NextResponse(null, {
    status: 307,
    headers: { Location: `${loginUrl.pathname}${loginUrl.search}` }
  }));
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/api/:path*']
};
