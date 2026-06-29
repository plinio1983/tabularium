import { destroyCurrentSession } from '@/lib/auth';
import { redirectToPath } from '@/lib/redirect';

export async function GET() {
  return redirectToPath('/login');
}

export async function POST() {
  await destroyCurrentSession();
  return redirectToPath('/login');
}
