import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {commitReceiptImport, prepareReceiptImport} from '@/lib/receipt-import';
import {exportReceiptCsv} from '@/lib/receipt-csv';
import {csvDownload} from '@/lib/csv-export';

export async function GET() {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  return csvDownload(exportReceiptCsv([{origin: 'negozio-2026-000001', date: '2026-09-10T14:30:00+02:00', description: 'Vendita di esempio', amount: '12.50', fiscal: true, vat: '22', channelCode: '', channel: 'Nome canale configurato', method: 'Nome metodo configurato', bank: 'Nome conto configurato', period: '2026-09', notes: ''}]), 'import-scontrini-template.csv');
}
export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !/\.csv$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) return NextResponse.json({error: 'Carica un CSV UTF-8 non vuoto, massimo 5 MB.'}, {status: 400});
    if (form.has('clearBeforeImport')) return NextResponse.json({error: 'La sostituzione dello storico scontrini non è consentita.'}, {status: 400});
    const text = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
    const context = {workspaceId: access.current.workspace.id, companyId: access.current.company.id};
    const mode = String(form.get('mode'));
    if (mode === 'preview') return NextResponse.json((await prepareReceiptImport(prisma, text, context)).preview);
    if (mode !== 'commit' || !form.get('token')) return NextResponse.json({error: 'Analizza il file prima di importare.'}, {status: 400});
    const result = await prisma.$transaction(async db => {
      const result = await commitReceiptImport(db, text, context, String(form.get('token')));
      await db.auditLog.create({data: {workspaceId: context.workspaceId, userId: access.current.user.id, action: 'IMPORT', entityType: 'CashRegisterReceipt', metadata: {...result, companyId: context.companyId, filename: file.name.slice(0, 200)}}});
      return result;
    }, {isolationLevel: 'Serializable', timeout: 60000});
    return NextResponse.json(result);
  } catch (error) {
    const code = (error as {code?: string})?.code;
    if (code === 'P2034' || code === 'P2002') return NextResponse.json({error: 'I dati sono cambiati durante l’importazione. Analizza nuovamente il file.'}, {status: 409});
    return NextResponse.json({error: error instanceof Error && !code ? error.message : 'Importazione non completata. Nessuno scontrino è stato salvato.'}, {status: 400});
  }
}
