import path from 'node:path';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readExpenseAttachment} from '@/lib/attachments';
import {createZip} from '@/lib/zip';
import {sendEmailNow} from '@/lib/email';
import {writeAuditLog} from '@/lib/audit';

export const runtime = 'nodejs';

const maxSelectedExpenses = 100;
const maxArchiveBytes = 50 * 1024 * 1024;
const maxEmailBytes = 18 * 1024 * 1024;

const RequestSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(maxSelectedExpenses),
  filter: z.enum(['ALL', 'INVOICES', 'PAYMENTS']).default('ALL'),
  action: z.enum(['SUMMARY', 'DOWNLOAD', 'SHARE', 'EMAIL']),
  email: z.string().trim().email().optional()
}).superRefine((value, context) => {
  if (value.action === 'EMAIL' && !value.email) context.addIssue({code: 'custom', path: ['email'], message: 'Indirizzo email obbligatorio'});
});

function attachmentTypes(filter: 'ALL' | 'INVOICES' | 'PAYMENTS') {
  if (filter === 'INVOICES') return ['INVOICE'] as const;
  if (filter === 'PAYMENTS') return ['PAYMENT_RECEIPT'] as const;
  return ['INVOICE', 'DOCUMENT', 'PAYMENT_RECEIPT'] as const;
}

function safeName(value: string) {
  const parsed = path.parse(value.replace(/[\\/\0\r\n]/g, '_'));
  const base = parsed.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').trim().slice(0, 100) || 'allegato';
  return `${base}${parsed.ext.toLowerCase().slice(0, 12)}`;
}

function archiveFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `allegati-spese-${date}.zip`;
}

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error: parsed.error.issues[0]?.message ?? 'Richiesta non valida'}, {status: 400});
  const input = parsed.data;
  const ids = [...new Set(input.ids)];
  const expenses = await prisma.expense.findMany({
    where: {id: {in: ids}, workspaceId: access.current.workspace.id, companyId: access.current.company.id},
    select: {
      id: true,
      attachments: {
        where: {type: {in: [...attachmentTypes(input.filter)]}},
        orderBy: {id: 'asc'},
        select: {id: true, originalName: true, path: true, sizeBytes: true, createdAt: true}
      }
    },
    orderBy: {id: 'asc'}
  });

  const attachments = expenses.flatMap(expense => expense.attachments.map(attachment => ({...attachment, expenseId: expense.id})));
  const declaredBytes = attachments.reduce((sum, attachment) => sum + (attachment.sizeBytes ?? 0), 0);
  if (input.action === 'SUMMARY') return NextResponse.json({
    selectedExpenses: ids.length,
    matchedExpenses: expenses.filter(expense => expense.attachments.length > 0).length,
    attachmentCount: attachments.length,
    totalBytes: declaredBytes
  });
  if (!attachments.length) return NextResponse.json({error: 'Nessun allegato corrisponde alla selezione'}, {status: 404});
  if (declaredBytes > maxArchiveBytes) return NextResponse.json({error: 'Gli allegati superano il limite complessivo di 50 MB'}, {status: 413});

  const usedNames = new Set<string>();
  const entries = [];
  let actualBytes = 0;
  for (const attachment of attachments) {
    const data = await readExpenseAttachment(attachment.path);
    actualBytes += data.length;
    if (actualBytes > maxArchiveBytes) return NextResponse.json({error: 'Gli allegati superano il limite complessivo di 50 MB'}, {status: 413});
    const original = safeName(attachment.originalName);
    const parsedName = path.parse(original);
    let candidate = `spesa-${attachment.expenseId}/${original}`;
    let suffix = 2;
    while (usedNames.has(candidate)) candidate = `spesa-${attachment.expenseId}/${parsedName.name}-${suffix++}${parsedName.ext}`;
    usedNames.add(candidate);
    entries.push({name: candidate, data, modifiedAt: attachment.createdAt});
  }

  const zip = createZip(entries);
  const filename = archiveFilename();
  if (input.action === 'EMAIL') {
    if (zip.length > maxEmailBytes) return NextResponse.json({error: 'L’archivio supera il limite email di 18 MB. Usa Scarica o Condividi.'}, {status: 413});
    await sendEmailNow({
      recipient: input.email!,
      subject: 'Allegati spese da Tabularium',
      textBody: `In allegato trovi ${attachments.length} documenti relativi alle spese selezionate in Tabularium.`,
      htmlBody: `<p>In allegato trovi <strong>${attachments.length}</strong> documenti relativi alle spese selezionate in Tabularium.</p>`,
      attachments: [{filename, content: zip, contentType: 'application/zip'}]
    });
    await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: 'EMAIL_ATTACHMENTS', entityType: 'Expense', metadata: {ids, filter: input.filter, count: attachments.length, recipient: input.email}, request});
    return NextResponse.json({ok: true, attachmentCount: attachments.length});
  }

  await writeAuditLog({workspaceId: access.current.workspace.id, userId: access.current.user.id, action: input.action === 'SHARE' ? 'SHARE_ATTACHMENTS' : 'DOWNLOAD_ATTACHMENTS', entityType: 'Expense', metadata: {ids, filter: input.filter, count: attachments.length}, request});
  return new NextResponse(new Uint8Array(zip), {headers: {
    'Content-Type': 'application/zip',
    'Content-Length': String(zip.length),
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  }});
}
