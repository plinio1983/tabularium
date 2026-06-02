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
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).optional(),
  paymentStatus: z.enum(['DA_PAGARE', 'COMPLETATO', 'PAGATO_PARZIALMENTE']).default('DA_PAGARE'),
  notes: z.string().optional()
});


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

function resolveBillingPeriod(data: z.infer<typeof ExpenseSchema>) {
  if (data.billingPeriod) {
    const [periodYear, month] = data.billingPeriod.split('-').map(Number);
    const year = data.year ?? periodYear;
    if (year && month) return { year, month };
  }
  const now = new Date();
  return {
    year: data.year ?? now.getFullYear(),
    month: data.month ?? now.getMonth() + 1
  };
}

function getAll(formData: FormData, key: string) {
  return formData.getAll(key).map(value => String(value || '').trim());
}

function parsePayments(formData: FormData | null, jsonPayments: unknown): PaymentInput[] {
  if (!formData) {
    if (!Array.isArray(jsonPayments)) return [];
    return jsonPayments
      .map((row: any) => ({
        paymentDate: row.paymentDate ? String(row.paymentDate) : undefined,
        channel: row.channel ? String(row.channel) : undefined,
        bankId: row.bankId ? Number(row.bankId) : null,
        amount: Number(row.amount || 0),
        paidBy: (row.paidBy === 'ALTRO_OPERATORE' ? 'ALTRO_OPERATORE' : 'HERBAL_MARKET') as PaymentInput['paidBy']
      }))
      .filter(row => row.amount > 0 || row.paymentDate || row.channel || row.bankId);
  }

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

function redirectAfterFormSave(request: Request, fallback: string) {
  const requestUrl = request.url;
  const explicitReturnTo = new URL(requestUrl).searchParams.get('returnTo');
  const referer = request.headers.get('referer');
  const target = safePath(explicitReturnTo, safePath(referer, fallback, requestUrl), requestUrl);
  return NextResponse.redirect(new URL(target, requestUrl), 303);
}

async function saveAttachments(files: FormDataEntryValue[]) {
  const validFiles = files.filter((file): file is File => file instanceof File && file.size > 0).slice(0, 5);
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

export async function GET() {
  const expenses = await prisma.expense.findMany({
    include: { category: true, bank: true, company: true, supplier: true, payments: { include: { bank: true } }, attachments: true },
    orderBy: { id: 'desc' },
    take: 500
  });
  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') || request.headers.get('content-type')?.includes('multipart/form-data');
  const formData = isForm ? await request.formData() : null;
  const raw = formData ? Object.fromEntries(formData.entries()) : await request.json();
  const data = ExpenseSchema.parse(raw);
  const invoiceFields = normalizeInvoiceFields(data);
  const { year, month } = resolveBillingPeriod(data);
  const payments = parsePayments(formData, (raw as any).payments);
  const supplierRef = await resolveSupplierReference(data);
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const attachments = formData ? await saveAttachments(formData.getAll('attachments')) : [];
  const firstPayment = payments[0];
  // Expense.bankId is legacy/denormalized. The real bank lives on each ExpensePayment row.
  const firstPaidBy = firstPayment?.paidBy ?? 'HERBAL_MARKET';

  await prisma.expense.create({ data: {
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
    companyId: null,
    isDeclared: invoiceFields.isDeclared,
    hasElectronicInvoice: invoiceFields.hasElectronicInvoice,
    invoiceStatus: invoiceFields.invoiceStatus,
    isComplete: data.paymentStatus === 'COMPLETATO',
    paidByCurrentAccount: firstPaidBy === 'HERBAL_MARKET',
    paymentStatus: data.paymentStatus,
    paidAmount,
    paidBy: firstPaidBy,
    invoiceDocumentPath: attachments[0]?.path ?? null,
    notes: data.notes || null,
    month,
    year,
    payments: {
      create: payments.map(payment => ({
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : null,
        channel: payment.channel || null,
        bankId: payment.bankId || null,
        amount: payment.amount,
        paidBy: payment.paidBy
      }))
    },
    attachments: {
      create: attachments
    }
  }});

  return isForm ? redirectAfterFormSave(request, '/expenses') : NextResponse.json({ ok: true });
}
