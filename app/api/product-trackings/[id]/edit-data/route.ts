import {NextResponse} from 'next/server';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {calendarDateInput} from '@/lib/company-time';

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({error: 'Tracciatura non valida.'}, {status: 400});
  const record = await prisma.productTracking.findFirst({
    where: {id, workspaceId: access.current.workspace.id, companyId: access.current.company.id},
    select: {id: true, name: true, batch: true, batchYear: true, alias: true, entryDate: true,
      attachments: {select: {id: true, kind: true, originalName: true, invoiceDate: true, documentDate: true, sizeBytes: true}, orderBy: {id: 'asc'}}},
  });
  if (!record) return NextResponse.json({error: 'Tracciatura non trovata.'}, {status: 404});
  return NextResponse.json({...record, entryDate: calendarDateInput(record.entryDate),
    attachments: record.attachments.map(item => ({...item, invoiceDate: calendarDateInput(item.invoiceDate), documentDate: calendarDateInput(item.documentDate)}))},
    {headers: {'Cache-Control': 'private, no-store'}});
}
