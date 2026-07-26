import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { ensureWorkspaceDefaults } from '@/lib/workspace-defaults';

const googleStateCookie = 'tabularium_google_oauth_state';
const googleScopes = ['openid', 'email', 'profile'];

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} non configurata`);
  return value;
}

async function baseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');

  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  if (!host) throw new Error('Host non disponibile per OAuth Google');
  return `${proto}://${host}`;
}

export async function googleRedirectUri() {
  return `${await baseUrl()}/api/auth/google/callback`;
}

export async function createGoogleAuthorizationUrl(nextPath = '/') {
  const state = randomBytes(32).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set(googleStateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60
  });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env('GOOGLE_CLIENT_ID'));
  url.searchParams.set('redirect_uri', await googleRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', googleScopes.join(' '));
  url.searchParams.set('state', `${state}:${encodeURIComponent(nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/')}`);
  url.searchParams.set('prompt', 'select_account');
  return url;
}

export async function consumeGoogleState(state: string | null) {
  if (!state) return null;
  const [token, encodedNext = '%2F'] = state.split(':');
  const cookieStore = await cookies();
  const expected = cookieStore.get(googleStateCookie)?.value;
  cookieStore.delete(googleStateCookie);
  if (!token || !expected || token !== expected) return null;

  const next = decodeURIComponent(encodedNext);
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse & { access_token: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
      redirect_uri: await googleRedirectUri()
    })
  });

  const data = await response.json() as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Token Google non valido');
  }
  return { ...data, access_token: data.access_token };
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await response.json() as GoogleUserInfo;
  if (!response.ok || !profile.sub || !profile.email || !profile.email_verified) {
    throw new Error('Profilo Google non valido o email non verificata');
  }
  return {
    googleId: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name ?? null
  };
}

export async function signInWithGoogleProfile(profile: { googleId: string; email: string; name: string | null }) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId: profile.googleId },
        { email: profile.email }
      ]
    }
  });

  if (user) {
    if (!user.isActive) throw new Error('Utente disattivato');
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? profile.googleId,
        email: profile.email,
        googleEmailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        name: user.name ?? profile.name
      }
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
        googleEmailVerified: true,
        emailVerifiedAt: new Date()
      }
    });
  }

  let membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { id: 'asc' }
  });

  if (!membership) {
    const workspace = await prisma.workspace.create({
      data: {
        name: profile.name ? `Workspace di ${profile.name}` : 'Il mio workspace',
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER'
          }
        }
      }
    });
    await ensureWorkspaceDefaults(workspace.id);
    membership = { id: 0, userId: user.id, workspaceId: workspace.id, role: 'OWNER', createdAt: new Date(), updatedAt: new Date() };
  }

  await createSession(user.id, membership.workspaceId);
}
