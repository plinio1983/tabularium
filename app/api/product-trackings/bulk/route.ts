import {NextResponse} from 'next/server';
import {posix} from 'node:path';
import {getWorkspaceContext, getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readExpenseAttachment, deleteExpenseAttachmentFile} from '@/lib/attachments';
import {writeAuditLog} from '@/lib/audit';
import {createZip} from '@/lib/zip';

const maxBytes = 50 * 1024 * 1024;
export async function POST(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
  const data = await request.formData();
  const values = data.getAll('ids').map(Number);
  const ids = [...new Set(values)];
  const action = String(data.get('bulkAction'));
  if (!ids.length || ids.length > 500 || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || !['delete', 'documents', 'invoices'].includes(action)) {
    return NextResponse.json({error: 'Selezione o azione non valida (massimo 500 tracciature).'}, {status: 400});
  }
  const where = {id: {in: ids}, workspaceId: current.workspace.id, companyId: current.company.id};
  if (action === 'delete') {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    try {
      const paths = await prisma.$transaction(async tx => {
        // Serialize with attachment edits and individual tracking deletion.
        for (const id of [...ids].sort((a, b) => a - b)) {
          await tx.$queryRaw`SELECT "id" FROM "ProductTracking" WHERE "id" = ${id} AND "workspaceId" = ${current.workspace.id} AND "companyId" = ${current.company.id} FOR UPDATE`;
        }
        const records = await tx.productTracking.findMany({where, include: {attachments: true}});
        if (records.length !== ids.length) return null;
        await tx.productTracking.deleteMany({where});
        await writeAuditLog({workspaceId: current.workspace.id, userId: current.user.id, action: 'BULK_DELETE', entityType: 'ProductTracking', metadata: {ids}, request}, tx);
        return records.flatMap(record => record.attachments.map(item => item.path));
      });
      if (!paths) return NextResponse.json({error: 'Una tracciatura selezionata non è disponibile.'}, {status: 404});
      const cleanup = await Promise.allSettled(paths.map(deleteExpenseAttachmentFile));
      if (cleanup.some(result => result.status === 'rejected')) console.error('Tracking bulk attachment cleanup failed');
      return NextResponse.json({ok: true});
    } catch (error) {
      console.error('Tracking bulk deletion failed', error);
      return NextResponse.json({error: 'Impossibile eliminare le tracciature.'}, {status: 500});
    }
  }
  const kind = action === 'invoices' ? 'INVOICE' : 'TRACKING';
  const records = await prisma.productTracking.findMany({where, orderBy: {id: 'asc'}, include: {attachments: {where: {kind}, orderBy: {id: 'asc'}}}});
  if (records.length !== ids.length) return NextResponse.json({error: 'Una tracciatura selezionata non è disponibile.'}, {status: 404});
  const attachments = records.flatMap(record => record.attachments.map(item => ({...item, trackingId: record.id})));
  if (!attachments.length) return NextResponse.json({error: 'Nessun allegato del tipo richiesto nelle tracciature selezionate.'}, {status: 404});
  if (attachments.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0) > maxBytes) return NextResponse.json({error: 'Gli allegati superano 50 MB.'}, {status: 413});
  const entries = [];
  let total = 0;
  for (const item of attachments) {
    let file;
    try {file = await readExpenseAttachment(item.path);} catch {return NextResponse.json({error: 'Un allegato non è disponibile. Archivio non creato.'}, {status: 404});}
    total += file.byteLength;
    if (total > maxBytes) return NextResponse.json({error: 'Gli allegati superano 50 MB.'}, {status: 413});
    const name = posix.basename(item.originalName.replaceAll('\\', '/')).replace(/[\x00-\x1f\x7f]/g, '_') || 'documento';
    entries.push({name: `tracciatura-${item.trackingId}/${item.id}-${name}`, data: file, modifiedAt: item.createdAt});
  }
  return new NextResponse(new Uint8Array(createZip(entries)), {headers: {
    'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="tracciature-${action === 'invoices' ? 'fatture' : 'documenti'}.zip"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  }});
}
