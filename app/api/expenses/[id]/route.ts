import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

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
  hasElectronicInvoice: BooleanFromForm.default(false),
  invoiceStatus: z.enum(['NON_PREVISTA', 'IN_ATTESA', 'INVIATA_SDI', 'CONTESTAZIONE', 'RICEVUTA']).default('IN_ATTESA'),
  billingPeriod: z.string().optional(),
  paymentStatus: z.enum(['DA_PAGARE', 'COMPLETATO', 'PAGATO_PARZIALMENTE']).default('DA_PAGARE'),
  notes: z.string().optional()
});



async function resolveSupplierReference(data: z.infer<typeof ExpenseSchema>) {
  const submittedName = String(data.merchant ?? '').trim();

  if (data.supplierId) {
    const existing = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (existing) return { id: existing.id, businessName: existing.businessName };
  }

  if (!submittedName) {
    throw new Error('Esercente/Fornitore obbligatorio');
  }

  const existingByName = await prisma.supplier.findFirst({
    where: { businessName: { equals: submittedName, mode: 'insensitive' } }
  });

  if (existingByName) return { id: existingByName.id, businessName: existingByName.businessName };

  const created = await prisma.supplier.create({
    data: { businessName: submittedName }
  });

  return { id: created.id, businessName: created.businessName };
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
  const banks = getAll(formData, 'paymentBankId[]');
  const amounts = getAll(formData, 'paymentAmount[]');
  const paidByRows = getAll(formData, 'paymentPaidBy[]');
  const length = Math.max(dates.length, channels.length, banks.length, amounts.length, paidByRows.length);
  const payments: PaymentInput[] = [];

  for (let index = 0; index < length; index++) {
    const amount = Number(amounts[index] || 0);
    const bankId = banks[index] ? Number(banks[index]) : null;
    const paymentDate = dates[index] || undefined;
    const channel = channels[index] || undefined;
    const paidBy = paidByRows[index] === 'ALTRO_OPERATORE' ? 'ALTRO_OPERATORE' : 'HERBAL_MARKET';
    if (amount > 0 || paymentDate || bankId || channel) {
      payments.push({ amount, bankId, paymentDate, channel, paidBy });
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
  const { id } = await params;
  const expenseId = Number(id);
  const formData = await request.formData();
  const raw = Object.fromEntries(formData.entries());
  const action = String(raw._action || 'update');
  const returnTo = new URL(request.url).searchParams.get('returnTo');
  if (action === 'delete') {
    await prisma.expense.delete({ where: { id: expenseId } });
    return NextResponse.redirect(new URL(returnTo || '/expenses', request.url), 303);
  }
  const data = ExpenseSchema.parse(raw);
  const invoiceFields = normalizeInvoiceFields(data);
  const { year, month } = resolveBillingPeriod(data.billingPeriod);
  const payments = parsePayments(formData);
  const supplierRef = await resolveSupplierReference(data);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const firstPayment = payments[0];
  // Expense.bankId is legacy/denormalized. The real bank lives on each ExpensePayment row.
  const firstPaidBy = firstPayment?.paidBy ?? 'HERBAL_MARKET';

  const existing = await prisma.expense.findUnique({ where: { id: expenseId }, include: { attachments: true } });
  if (!existing) return NextResponse.json({ error: 'Spesa non trovata' }, { status: 404 });

  const attachments = await saveAttachments(formData.getAll('attachments'), existing.attachments.length);

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      merchant: supplierRef.businessName,
      supplierId: supplierRef.id,
      categoryId: data.categoryId || null,
      description: data.description || null,
      amount: data.amount,
      paymentDate: data.paymentStatus === 'DA_PAGARE' ? null : (firstPayment?.paymentDate ? new Date(firstPayment.paymentDate) : null),
      vatRate: data.vatRate,
      channel: firstPayment?.channel || null,
      bankId: firstPayment?.bankId || null,
      isDeclared: invoiceFields.isDeclared,
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
          bankId: payment.bankId || null,
          amount: payment.amount,
          paidBy: payment.paidBy
        }))
      },
      attachments: attachments.length ? { create: attachments } : undefined
    }
  });

  return NextResponse.redirect(new URL(returnTo || `/expenses/${expenseId}`, request.url), 303);
}
