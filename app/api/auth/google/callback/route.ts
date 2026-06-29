import { consumeGoogleState, exchangeGoogleCode, fetchGoogleUserInfo, signInWithGoogleProfile } from '@/lib/google-auth';
import { pathFromUrl, redirectToPath } from '@/lib/redirect';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = await consumeGoogleState(url.searchParams.get('state'));
  if (!code || !next) {
    return redirectToPath('/login?error=google_state', 307);
  }

  try {
    const token = await exchangeGoogleCode(code);
    const profile = await fetchGoogleUserInfo(token.access_token);
    await signInWithGoogleProfile(profile);
    return redirectToPath(pathFromUrl(next, '/'), 307);
  } catch (error) {
    console.error(error);
    return redirectToPath('/login?error=google', 307);
  }
}
