import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {saveExpenseAttachmentFiles, deleteExpenseAttachmentFile, AttachmentValidationError} from '@/lib/attachments';
import {parseTrackingDate, TrackingValidationError} from '@/lib/product-tracking';
import {saveTrackingInvoiceFile} from '@/lib/product-tracking-invoice-file';
import {writeAuditLog} from '@/lib/audit';

export async function saveTracking(request: Request, id?: number) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {current} = access;
  if (id !== undefined && (!Number.isInteger(id) || id <= 0)) return NextResponse.json({error: 'Tracciatura non valida.'}, {status: 400});
  const scope = {workspaceId: current.workspace.id, companyId: current.company.id};
  const newlySaved: string[] = [];
  let removedPaths: string[] = [];
  let resultId: number | undefined;
  try {
    let form: FormData;
    try {form = await request.formData();} catch {throw new TrackingValidationError('Dati del form non validi.');}
    const name = String(form.get('name') ?? '').trim();
    const batch = String(form.get('batch') ?? '').trim();
    if (!name || !batch || name.length > 250 || batch.length > 250) throw new TrackingValidationError('Riferimento e lotto sono obbligatori (massimo 250 caratteri).');
    const alias = String(form.get('alias') ?? '').trim();
    if (alias.length > 250) throw new TrackingValidationError('Nome troppo lungo.');
    const entryDate = parseTrackingDate(form.get('entryDate'));
    resultId = await prisma.$transaction(async tx => {
      // Serialize edits, including uploads and attachment counts, on the parent row.
      if (id) await tx.$queryRaw`SELECT "id" FROM "ProductTracking" WHERE "id" = ${id} AND "workspaceId" = ${scope.workspaceId} AND "companyId" = ${scope.companyId} FOR UPDATE`;
      const existing = id ? await tx.productTracking.findFirst({where: {id, ...scope}, include: {attachments: true}}) : null;
      if (id && !existing) throw new TrackingValidationError('Tracciatura non trovata.', 404);
      const removed = new Set(form.getAll('removedIds').map(String));
      if ([...removed].some(value => !existing?.attachments.some(a => String(a.id) === value))) throw new TrackingValidationError('Allegato non valido.');
      const retained = existing?.attachments.filter(a => !removed.has(String(a.id))) ?? [];
      const additions = [];
      for (const kind of ['INVOICE', 'TRACKING'] as const) {
        const entries = form.getAll(kind);
        if (entries.some(f => !(f instanceof File) || f.size === 0)) throw new TrackingValidationError('Gli allegati devono essere file non vuoti.');
        const files = entries as File[];
        if (retained.filter(a => a.kind === kind).length + files.length > 5) throw new TrackingValidationError('Puoi allegare massimo 5 fatture e 5 documenti di tracciamento.');
        const dates = files.map((_, index) => kind === 'INVOICE' ? parseTrackingDate(form.get(`invoiceDate-new-${index}`), true) : null);
        for (const attachment of retained.filter(a => a.kind === kind)) {
          const invoiceDate = kind === 'INVOICE' ? parseTrackingDate(form.get(`invoiceDate-${attachment.id}`), true) : null;
          const replacement = await saveTrackingInvoiceFile(form.getAll(`${kind === 'INVOICE' ? 'invoice' : 'tracking'}Replacement-${attachment.id}`), false);
          if (replacement) {newlySaved.push(replacement.path); removedPaths.push(attachment.path);}
          await tx.productTrackingAttachment.update({where: {id: attachment.id}, data: {invoiceDate, ...(replacement ?? {})}});
        }
        for (const [index, file] of files.entries()) {
          const [saved] = await saveExpenseAttachmentFiles([file]);
          newlySaved.push(saved.path);
          const {type: _type, ...metadata} = saved;
          additions.push({...metadata, kind, invoiceDate: dates[index]});
        }
      }
      removedPaths.push(...(existing?.attachments.filter(a => removed.has(String(a.id))).map(a => a.path) ?? []));
      if (id) await tx.productTrackingAttachment.deleteMany({where: {trackingId: id, id: {in: [...removed].map(Number)}}});
      const data = {name, batch, alias: alias || null, entryDate};
      const record = id
        ? await tx.productTracking.update({where: {id}, data: {...data, attachments: {create: additions}}})
        : await tx.productTracking.create({data: {...scope, ...data, attachments: {create: additions}}});
      await writeAuditLog({workspaceId: scope.workspaceId, userId: current.user.id, action: id ? 'UPDATE' : 'CREATE', entityType: 'ProductTracking', entityId: record.id, request}, tx);
      return record.id;
    }, {timeout: 120000});
  } catch (error) {
    const cleanup = await Promise.allSettled(newlySaved.map(deleteExpenseAttachmentFile));
    if (cleanup.some(r => r.status === 'rejected')) console.error('Product tracking rollback cleanup failed');
    if (error instanceof TrackingValidationError || error instanceof AttachmentValidationError) {
      return NextResponse.json({error: error.message}, {status: error instanceof TrackingValidationError ? error.status : 400});
    }
    console.error('Product tracking save failed', error);
    return NextResponse.json({error: 'Impossibile salvare la tracciatura. Riprova.'}, {status: 500});
  }
  const cleanup = await Promise.allSettled(removedPaths.map(deleteExpenseAttachmentFile));
  if (cleanup.some(r => r.status === 'rejected')) console.error('Product tracking attachment cleanup failed', resultId);
  return NextResponse.json({id: resultId});
}

export async function deleteTracking(request: Request, id: number) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {current} = access;
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({error: 'Tracciatura non valida.'}, {status: 400});
  let paths: string[] | null;
  try {
    paths = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "ProductTracking" WHERE "id" = ${id} AND "workspaceId" = ${current.workspace.id} AND "companyId" = ${current.company.id} FOR UPDATE`;
      const record = await tx.productTracking.findFirst({where: {id, workspaceId: current.workspace.id, companyId: current.company.id}, include: {attachments: true}});
      if (!record) return null;
      await tx.productTracking.delete({where: {id}});
      await writeAuditLog({workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE', entityType: 'ProductTracking', entityId: id, request}, tx);
      return record.attachments.map(a => a.path);
    });
  } catch (error) {
    console.error('Product tracking deletion failed', error);
    return NextResponse.json({error: 'Impossibile eliminare la tracciatura. Riprova.'}, {status: 500});
  }
  if (!paths) return NextResponse.json({error: 'Tracciatura non trovata.'}, {status: 404});
  const cleanup = await Promise.allSettled(paths.map(deleteExpenseAttachmentFile));
  if (cleanup.some(r => r.status === 'rejected')) console.error('Product tracking attachment cleanup failed', id);
  return NextResponse.json({ok: true});
}
