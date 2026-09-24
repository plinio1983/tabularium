import {appendFlash} from '@/lib/flash';
import {pathFromUrl, redirectToPath} from '@/lib/redirect';
import {writeAuditLog} from '@/lib/audit';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceApiAccess, workspaceOperationalRoles } from '@/lib/auth';
import { z } from 'zod';
import {changeRecurringStateInTransaction} from '@/lib/recurring-state';
import {recurringStateResponse} from '@/lib/recurring-state-response';
import {RecurringStateError} from '@/lib/recurring-suspensions';

const bool = z.preprocess(value => ['true', 'on', '1', true].includes(value as never), z.boolean());
const recurringIncomeSchema = z.object({
  startDate: z.string().min(1), cadence: z.enum(['MONTHLY', 'EVERY_2_MONTHS', 'EVERY_3_MONTHS', 'EVERY_6_MONTHS', 'YEARLY', 'EVERY_2_YEARS']),
  endDate: z.string().optional().transform(value => value || null),
  creditDay: z.coerce.number().min(1).max(31).optional().nullable(), creditMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  billingPeriodMode: z.enum(['SAME_MONTH', 'NEXT_MONTH', 'CUSTOM_MONTH']).default('SAME_MONTH'), billingMonth: z.coerce.number().min(1).max(12).optional().nullable(),
  customerId: z.coerce.number().optional().nullable(), salesChannelId: z.coerce.number(),
  description: z.string().min(1), amount: z.coerce.number().positive(), vatRate: z.coerce.number().min(0).default(22),
  isFiscal: bool.default(false), isAutomaticCredit: bool.default(false), paymentMethodId: z.coerce.number().optional().nullable(), bankId: z.coerce.number().optional().nullable(), notes: z.string().optional(),
  isActive: bool.default(false)
}).superRefine((data, context) => {
  if (data.endDate && data.endDate < data.startDate) context.addIssue({code: 'custom', path: ['endDate'], message: 'La data di fine non può precedere la data iniziale'});
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const id = Number((await context.params).id);
  const existing = await prisma.recurringIncome.findFirst({ where: { id, workspaceId: access.current.workspace.id, companyId: access.current.company.id } });
  if (!existing) return NextResponse.json({ error: 'Entrata ricorrente non trovata' }, { status: 404 });
  const data = recurringIncomeSchema.parse(Object.fromEntries((await request.formData()).entries()));
  const workspaceId = access.current.workspace.id;
  const [channel, customer, method, bank] = await Promise.all([
    prisma.incomeSalesChannel.findFirst({ where: { id: data.salesChannelId, workspaceId } }),
    data.customerId ? prisma.customer.findFirst({ where: { id: data.customerId, workspaceId } }) : null,
    data.paymentMethodId ? prisma.paymentMethod.findFirst({ where: { id: data.paymentMethodId, workspaceId } }) : null,
    data.bankId ? prisma.bank.findFirst({ where: { id: data.bankId, workspaceId } }) : null
  ]);
  if (!channel || (data.customerId && !customer) || (data.paymentMethodId && !method) || (data.bankId && !bank)) return NextResponse.json({ error: 'Riferimenti non validi' }, { status: 400 });
  if (data.isAutomaticCredit && (!data.paymentMethodId || !data.bankId)) return NextResponse.json({ error: 'Metodo e banca sono obbligatori' }, { status: 400 });
  try {
    await prisma.$transaction(async tx => {
      await tx.recurringIncome.update({ where: { id }, data: {
        startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null,
        cadence: data.cadence, creditDay: data.creditDay || null,
        creditMonth: ['YEARLY', 'EVERY_2_YEARS'].includes(data.cadence) ? data.creditMonth || null : null,
        billingPeriodMode: data.billingPeriodMode, billingMonth: data.billingPeriodMode === 'CUSTOM_MONTH' ? data.billingMonth || null : null,
        customerId: data.customerId || null, salesChannelId: data.salesChannelId,
        description: data.description, amount: data.amount, vatRate: data.vatRate, isFiscal: data.isFiscal,
        isAutomaticCredit: data.isAutomaticCredit, paymentMethodId: data.isAutomaticCredit ? data.paymentMethodId : null,
        bankId: data.isAutomaticCredit ? data.bankId : null, notes: data.notes || null
      } });
      await changeRecurringStateInTransaction(tx, 'income', [id], data.isActive, {
        workspaceId, companyId: access.current.company.id, userId: access.current.user.id, timeZone: access.current.company.timeZone
      }, request);
    });
  } catch (error) {
    if (error instanceof RecurringStateError) return NextResponse.json({error: error.message}, {status: 400});
    throw error;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const id = Number((await context.params).id);
  return recurringStateResponse(request, 'income', [id], false, access.current, '/recurring-incomes');
}

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({error: 'ID entrata ricorrente non valido'}, {status: 400});
  const formData = await request.formData();
  if (formData.get('_action') !== 'delete') return NextResponse.json({error: 'Azione non valida'}, {status: 400});
  const current = access.current;
  const deleted = await prisma.recurringIncome.deleteMany({where: {
    id, workspaceId: current.workspace.id, companyId: current.company.id
  }});
  if (deleted.count) await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
    entityType: 'RecurringIncome', entityId: id, request
  });
  const returnTo = pathFromUrl(new URL(request.url).searchParams.get('returnTo'), '/recurring-incomes');
  return redirectToPath(appendFlash(returnTo, deleted.count ? {saved: 'deleted'} : {error: 'not_found'}));
}
