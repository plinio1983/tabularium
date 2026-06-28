import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getWorkspaceContext } from '@/lib/auth';
import { appendFlash } from '@/lib/flash';
import { redirectToPath } from '@/lib/redirect';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BooleanFromForm = z.preprocess((value) => value === true || value === 'true' || value === 'on' || value === '1', z.boolean());

const ExpenseSchema = z.object({
  receivedDate: z.string().optional(),
  dueDate: z.string().optional(),
  merchant: z.string().optional().default(''),
  supplierId: z.coerce.number().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  description: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  vatRate: z.coerce.number().default(22),
  isDeclared: BooleanFromForm.default(false),
  isRecurring: BooleanFromForm.default(false),
  hasElectronicInvoice: BooleanFromForm.default(false),
  invoiceStatus: z.enum(['NON_PREVISTA', 'IN_ATTESA', 'INVIATA_SDI', 'CONTESTAZIONE', 'RICEVUTA']).default('IN_ATTESA'),
  billingPeriod: z.string().optional(),
  paymentStatus: z.enum(['DA_PAGARE', 'COMPLETATO', 'PAGATO_PARZIALMENTE']).default('DA_PAGARE'),
  notes: z.string().optional()
});



async function resolveSupplierReference(data: z.infer<typeof ExpenseSchema>, workspaceId: number) {
  const submittedName = String(data.merchant ?? '').trim();

  if (data.supplierId) {
    const existing = await prisma.supplier.findFirst({ where: { id: data.supplierId, workspaceId } });
    if (existing) return { id: existing.id, businessName: existing.businessName };
  }

  if (!submittedName) {
    throw new Error('Esercente obbligatorio');
  }

  const existingByName = await prisma.supplier.findFirst({
    where: { businessName: { equals: submittedName, mode: 'insensitive' }, workspaceId }
  });

  if (existingByName) return { id: existingByName.id, businessName: existingByName.businessName };

  const created = await prisma.supplier.create({
    data: { businessName: submittedName, workspaceId }
  });

  return { id: created.id, businessName: created.businessName };
}

async function resolveCategoryId(categoryId: number | null | undefined, workspaceId: number) {
  if (!categoryId) return null;
  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, workspaceId } });
  if (!category) throw new Error('Categoria non valida');
  return category.id;
}

async function resolvePaymentInputs(payments: PaymentInput[], workspaceId: number) {
  if (!payments.length) return payments;
  const methods = await prisma.paymentMethod.findMany({ where: { workspaceId } });
  return payments.map(payment => {
    const method = payment.paymentMethodId
      ? methods.find(item => item.id === payment.paymentMethodId)
      : payment.channel
        ? methods.find(item => item.name.toLowerCase() === payment.channel!.toLowerCase())
        : null;
    if (payment.paymentMethodId && !method) throw new Error('Metodo pagamento non valido');
    return { ...payment, paymentMethodId: method?.id ?? null, channel: method?.name ?? payment.channel };
  });
}

function safePath(value: string | null, fallback: string, requestUrl: string) {
  if (!value) return fallback;
  try {
    const url = value.startsWith('http') ? new URL(value) : new URL(value, requestUrl);
    if (url.origin !== new URL(requestUrl).origin) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : fallback;
  }
}

function normalizeInvoiceFields(data: z.infer<typeof ExpenseSchema>) {
  if (!data.isDeclared) {
    return { isDeclared: false, hasElectronicInvoice: false, invoiceStatus: 'NON_PREVISTA' as const };
  }
  if (data.invoiceStatus === 'NON_PREVISTA') {
    return { isDeclared: true, hasElectronicInvoice: data.hasElectronicInvoice, invoiceStatus: 'IN_ATTESA' as const };
  }
  return {
    isDeclared: data.isDeclared,
    hasElectronicInvoice: data.hasElectronicInvoice,
    invoiceStatus: data.invoiceStatus === 'INVIATA_SDI' ? 'RICEVUTA' as const : data.invoiceStatus,
  };
}

type PaymentInput = {
  paymentDate?: string;
  channel?: string;
  paymentMethodId?: number | null;
  bankId?: number | null;
  amount: number;
  paidBy: 'HERBAL_MARKET' | 'ALTRO_OPERATORE';
};

function resolveBillingPeriod(billingPeriod?: string) {
  if (billingPeriod) {
    const [year, month] = billingPeriod.split('-').map(Number);
    if (year && month) return { year, month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getAll(formData: FormData, key: string) {
  return formData.getAll(key).map(value => String(value || '').trim());
}

function parsePayments(formData: FormData): PaymentInput[] {
  const dates = getAll(formData, 'paymentDate[]');
  const channels = getAll(formData, 'paymentChannel[]');
  const methodIds = getAll(formData, 'paymentMethodId[]');
  const banks = getAll(formData, 'paymentBankId[]');
  const amounts = getAll(formData, 'paymentAmount[]');
  const paidByRows = getAll(formData, 'paymentPaidBy[]');
  const length = Math.max(dates.length, channels.length, methodIds.length, banks.length, amounts.length, paidByRows.length);
  const payments: PaymentInput[] = [];

  for (let index = 0; index < length; index++) {
    const amount = Number(amounts[index] || 0);
    const bankId = banks[index] ? Number(banks[index]) : null;
    const paymentDate = dates[index] || undefined;
    const channel = channels[index] || undefined;
    const paymentMethodId = methodIds[index] ? Number(methodIds[index]) : null;
    const paidBy = paidByRows[index] === 'ALTRO_OPERATORE' ? 'ALTRO_OPERATORE' : 'HERBAL_MARKET';
    if (amount > 0 || paymentDate || bankId || channel || paymentMethodId) {
      payments.push({ amount, bankId, paymentDate, channel, paymentMethodId, paidBy });
    }
  }

  return payments.filter(row => row.amount > 0);
}

async function saveAttachments(files: FormDataEntryValue[], existingCount: number) {
  const validFiles = files.filter((file): file is File => file instanceof File && file.size > 0).slice(0, Math.max(0, 5 - existingCount));
  if (!validFiles.length) return [];

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'invoices');
  await mkdir(uploadDir, { recursive: true });

  const saved = [];
  for (const file of validFiles) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);
    saved.push({
      originalName: file.name,
      path: `/uploads/invoices/${filename}`,
      mimeType: file.type || null,
      sizeBytes: file.size
    });
  }
  return saved;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { id } = await params;
  const expenseId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');
  const returnTo = new URL(request.url).searchParams.get('returnTo');
  if (action === 'delete') {
    await prisma.expense.deleteMany({ where: { id: expenseId, workspaceId: current.workspace.id } });
    const target = safePath(returnTo, '/expenses', request.url);
    return redirectToPath(appendFlash(target, { saved: 'deleted' }));
  }
  const data = ExpenseSchema.parse(raw);
  const invoiceFields = normalizeInvoiceFields(data);
  const { year, month } = resolveBillingPeriod(data.billingPeriod);
  const payments = await resolvePaymentInputs(parsePayments(formData), current.workspace.id);
  const supplierRef = await resolveSupplierReference(data, current.workspace.id);
  const categoryId = await resolveCategoryId(data.categoryId, current.workspace.id);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const firstPayment = payments[0];
  // Expense.bankId is legacy/denormalized. The real bank lives on each ExpensePayment row.
  const firstPaidBy = firstPayment?.paidBy ?? 'HERBAL_MARKET';

  const existing = await prisma.expense.findFirst({ where: { id: expenseId, workspaceId: current.workspace.id }, include: { attachments: true } });
  if (!existing) {
    const target = safePath(returnTo, '/expenses', request.url);
    return redirectToPath(appendFlash(target, { error: 'not_found' }));
  }
  const nextIsRecurring = existing.isRecurring ? data.isRecurring : false;

  const attachments = await saveAttachments(formData.getAll('attachments'), existing.attachments.length);

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      merchant: supplierRef.businessName,
      supplierId: supplierRef.id,
      categoryId,
      description: data.description || null,
      amount: data.amount,
      paymentDate: data.paymentStatus === 'DA_PAGARE' ? null : (firstPayment?.paymentDate ? new Date(firstPayment.paymentDate) : null),
      vatRate: data.vatRate,
      channel: firstPayment?.channel || null,
      bankId: firstPayment?.bankId || null,
      isDeclared: invoiceFields.isDeclared,
      isRecurring: nextIsRecurring,
      hasElectronicInvoice: invoiceFields.hasElectronicInvoice,
      invoiceStatus: invoiceFields.invoiceStatus,
      isComplete: data.paymentStatus === 'COMPLETATO',
      paidByCurrentAccount: firstPaidBy === 'HERBAL_MARKET',
      paymentStatus: data.paymentStatus,
      paidAmount,
      paidBy: firstPaidBy,
      invoiceDocumentPath: existing.invoiceDocumentPath ?? attachments[0]?.path ?? null,
      notes: data.notes || null,
      month,
      year,
      payments: {
        deleteMany: {},
        create: payments.map(payment => ({
          paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : null,
          channel: payment.channel || null,
          paymentMethodId: payment.paymentMethodId || null,
          bankId: payment.bankId || null,
          amount: payment.amount,
          paidBy: payment.paidBy
        }))
      },
      attachments: attachments.length ? { create: attachments } : undefined
    }
  });

  const target = safePath(returnTo, `/expenses/${expenseId}`, request.url);
  return redirectToPath(appendFlash(target, { saved: 'updated' }));
}
