import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const sessionCookieName = 'tabularium_session';

const publicPrefixes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/resend-verification',
  '/api/auth',
  '/api/cron',
  '/api/jobs',
  '/admin/login',
  '/admin/setup',
  '/_next',
  '/icons',
  '/templates'
];

const publicPaths = new Set([
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
  '/api/health'
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

function requestHost(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return forwardedHost || request.headers.get('host') || request.nextUrl.host;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const origin = request.headers.get('origin');
  if (isMutation && origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      return noStore(NextResponse.json({ error: 'Origine richiesta non valida' }, { status: 403 }));
    }
    if (originHost !== requestHost(request)) {
      return noStore(NextResponse.json({ error: 'Origine richiesta non consentita' }, { status: 403 }));
    }
  }
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
  return noStore(NextResponse.redirect(loginUrl, 307));
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/api/:path*']
};
