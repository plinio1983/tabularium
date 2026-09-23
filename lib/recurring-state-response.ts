import {NextResponse} from 'next/server';
import {changeRecurringState, type RecurringKind} from '@/lib/recurring-state';
import {RecurringStateError} from '@/lib/recurring-suspensions';
import {appendFlash} from '@/lib/flash';
import {redirectToPath} from '@/lib/redirect';

export async function recurringStateResponse(request: Request, kind: RecurringKind, ids: number[], active: boolean,
  current: {workspace: {id: number}; company: {id: number; timeZone: string}; user: {id: number}}, returnTo: string) {
  const json = request.headers.get('accept')?.includes('application/json');
  try {
    await changeRecurringState(kind, ids, active, {
      workspaceId: current.workspace.id, companyId: current.company.id,
      timeZone: current.company.timeZone, userId: current.user.id
    }, request);
    return json ? NextResponse.json({ok: true, active}) : redirectToPath(appendFlash(returnTo, {saved: active ? 'activated' : 'deactivated'}));
  } catch (error) {
    if (!(error instanceof RecurringStateError)) throw error;
    return json ? NextResponse.json({error: error.message}, {status: 400})
      : redirectToPath(appendFlash(returnTo, {error: 'invalid_state'}));
  }
}
