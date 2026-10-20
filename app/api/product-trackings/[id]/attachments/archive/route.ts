import {NextResponse} from 'next/server';
import {posix} from 'node:path';
import {getWorkspaceContext} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readExpenseAttachment} from '@/lib/attachments';
import {createZip} from '@/lib/zip';

const maxArchiveBytes = 50 * 1024 * 1024;

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
  const id = Number((await params).id);
  const kind = new URL(request.url).searchParams.get('kind');
  if (!Number.isSafeInteger(id) || id <= 0 || kind !== 'INVOICE' && kind !== 'TRACKING') {
    return NextResponse.json({error: 'Tracciatura o tipo di documento non valido'}, {status: 400});
  }
  const tracking = await prisma.productTracking.findFirst({
    where: {id, workspaceId: current.workspace.id, companyId: current.company.id},
    select: {attachments: {where: {kind}, orderBy: {id: 'asc'}, select: {id: true, originalName: true, path: true, sizeBytes: true, createdAt: true}}},
  });
  if (!tracking) return NextResponse.json({error: 'Tracciatura non trovata'}, {status: 404});
  if (!tracking.attachments.length) return NextResponse.json({error: 'Nessun documento da scaricare'}, {status: 404});
  if (tracking.attachments.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0) > maxArchiveBytes) {
    return NextResponse.json({error: 'Gli allegati superano il limite complessivo di 50 MB'}, {status: 413});
  }
  const entries = [];
  let totalBytes = 0;
  for (const attachment of tracking.attachments) {
    let data;
    try {data = await readExpenseAttachment(attachment.path);} catch {
      return NextResponse.json({error: 'Un file allegato non è disponibile. Archivio non creato.'}, {status: 404});
    }
    totalBytes += data.byteLength;
    if (totalBytes > maxArchiveBytes) return NextResponse.json({error: 'Gli allegati superano il limite complessivo di 50 MB'}, {status: 413});
    const basename = posix.basename(attachment.originalName.replaceAll('\\', '/')).replace(/[\x00-\x1f\x7f]/g, '_') || 'documento';
    entries.push({name: `${attachment.id}-${basename}`, data, modifiedAt: attachment.createdAt});
  }
  const zip = createZip(entries);
  const filename = `tracciatura-${id}-${kind === 'INVOICE' ? 'fatture' : 'documenti'}.zip`;
  return new NextResponse(new Uint8Array(zip), {headers: {
    'Content-Type': 'application/zip', 'Content-Length': String(zip.byteLength),
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  }});
}
