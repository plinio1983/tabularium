import { NextResponse } from 'next/server';
import { createGoogleAuthorizationUrl } from '@/lib/google-auth';
import { redirectToPath } from '@/lib/redirect';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/';
  try {
    return NextResponse.redirect(await createGoogleAuthorizationUrl(next));
  } catch (error) {
    console.error(error);
    return redirectToPath('/login?error=google_config', 307);
  }
}
