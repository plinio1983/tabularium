import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {AttachmentValidationError, deleteExpenseAttachmentFile} from '@/lib/attachments';
import {parseTrackingDate, TrackingValidationError} from '@/lib/product-tracking';
import {saveTrackingInvoiceFile} from '@/lib/product-tracking-invoice-file';
import {writeAuditLog} from '@/lib/audit';

export async function mutateTrackingAttachment(request: Request, trackingId: number, invoiceId?: number, remove = false, kind: 'INVOICE' | 'TRACKING' = 'INVOICE') {
  const isInvoice = kind === 'INVOICE';
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  if (!Number.isInteger(trackingId) || trackingId <= 0 || (invoiceId !== undefined && (!Number.isInteger(invoiceId) || invoiceId <= 0)) || (remove && !invoiceId)) {
    return NextResponse.json({error: isInvoice ? 'Fattura non valida.' : 'Documento di tracciamento non valido.'}, {status: 400});
  }
  const {current} = access;
  const scope = {workspaceId: current.workspace.id, companyId: current.company.id};
  const uploaded: string[] = [], obsolete: string[] = [];
  try {
    let form: FormData | null = null;
    if (!remove) {
      try {form = await request.formData();} catch {throw new TrackingValidationError('Dati del documento non validi.');}
    }
    const invoiceDate = remove || !isInvoice ? null : parseTrackingDate(form!.get('invoiceDate'), true);
    const invoice = await prisma.$transaction(async tx => {
      // The same parent lock is used by the full editor and every invoice operation.
      await tx.$queryRaw`SELECT "id" FROM "ProductTracking" WHERE "id" = ${trackingId} AND "workspaceId" = ${scope.workspaceId} AND "companyId" = ${scope.companyId} FOR UPDATE`;
      const tracking = await tx.productTracking.findFirst({where: {id: trackingId, ...scope}, include: {attachments: {where: {kind}}}});
      if (!tracking) throw new TrackingValidationError('Tracciatura non trovata.', 404);
      const existing = invoiceId ? tracking.attachments.find(a => a.id === invoiceId && a.kind === kind) : null;
      if (invoiceId && !existing) throw new TrackingValidationError(isInvoice ? 'Fattura non trovata.' : 'Documento di tracciamento non trovato.', 404);
      if (!invoiceId && tracking.attachments.length >= 5) throw new TrackingValidationError(isInvoice ? 'Puoi allegare massimo 5 fatture.' : 'Puoi allegare massimo 5 documenti di tracciamento.');
      let result;
      if (remove) {
        result = await tx.productTrackingAttachment.delete({where: {id: invoiceId!}});
        obsolete.push(existing!.path);
      } else {
        const file = await saveTrackingInvoiceFile(form!.getAll('document'), !invoiceId);
        if (file) uploaded.push(file.path);
        result = existing
          ? await tx.productTrackingAttachment.update({where: {id: existing.id}, data: {invoiceDate, ...(file ?? {})}})
          : await tx.productTrackingAttachment.create({data: {trackingId, kind, invoiceDate, ...file!}});
        if (existing && file) obsolete.push(existing.path);
      }
      await tx.productTracking.update({where: {id: trackingId}, data: {updatedAt: new Date()}});
      await writeAuditLog({workspaceId: scope.workspaceId, userId: current.user.id, action: remove ? 'DELETE' : invoiceId ? 'UPDATE' : 'CREATE', entityType: 'ProductTrackingAttachment', entityId: result.id, metadata: {trackingId, kind}, request}, tx);
      return result;
    }, {timeout: 120000});
    const cleanup = await Promise.allSettled(obsolete.map(deleteExpenseAttachmentFile));
    if (cleanup.some(r => r.status === 'rejected')) console.error('Product tracking invoice cleanup failed', trackingId);
    return NextResponse.json(remove ? {ok: true} : invoice);
  } catch (error) {
    const cleanup = await Promise.allSettled(uploaded.map(deleteExpenseAttachmentFile));
    if (cleanup.some(r => r.status === 'rejected')) console.error('Product tracking invoice rollback cleanup failed', trackingId);
    if (error instanceof TrackingValidationError || error instanceof AttachmentValidationError) {
      return NextResponse.json({error: error.message}, {status: error instanceof TrackingValidationError ? error.status : 400});
    }
    console.error('Product tracking invoice operation failed', error);
    return NextResponse.json({error: isInvoice ? 'Impossibile salvare la fattura. Riprova.' : 'Impossibile salvare il documento di tracciamento. Riprova.'}, {status: 500});
  }
}

export function mutateTrackingInvoice(request: Request, trackingId: number, invoiceId?: number, remove = false) {
  return mutateTrackingAttachment(request, trackingId, invoiceId, remove, 'INVOICE');
}
export function mutateTrackingDocument(request: Request, trackingId: number, documentId?: number, remove = false) {
  return mutateTrackingAttachment(request, trackingId, documentId, remove, 'TRACKING');
}
