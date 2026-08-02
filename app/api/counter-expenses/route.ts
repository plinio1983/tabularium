import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ensureWorkspaceDefaults} from '@/lib/workspace-defaults';
import {writeAuditLog} from '@/lib/audit';
import {yearMonthInTimeZone} from '@/lib/company-time';

const allowedVatRates = [0, 4, 10, 22];
const CounterExpenseSchema = z.object({
  amount: z.coerce.number().positive().max(999999999.99),
  isDeductible: z.boolean(),
  vatRate: z.coerce.number(),
  paymentDate: z.string().datetime(),
  categoryId: z.coerce.number().int().positive(),
  description: z.string().trim().max(200).optional(),
  paymentMethodId: z.coerce.number().int().positive(),
  bankId: z.coerce.number().int().positive().nullable(),
  requestId: z.string().uuid()
});

export async function POST(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const current = access.current;
  await ensureWorkspaceDefaults(current.workspace.id);

  const parsed = CounterExpenseSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({error: 'Dati della spesa non validi'}, {status: 400});
  const input = parsed.data;
  const vatRate = input.isDeductible ? input.vatRate : 0;
  if (!allowedVatRates.includes(vatRate)) {
    return NextResponse.json({error: 'Aliquota IVA non valida'}, {status: 400});
  }
  const paymentDate = new Date(input.paymentDate);
  if (Number.isNaN(paymentDate.getTime())) return NextResponse.json({error: 'Data pagamento non valida'}, {status: 400});

  const [supplier, category, method] = await Promise.all([
    prisma.supplier.findFirst({
      where: {workspaceId: current.workspace.id, systemRole: 'COUNTER_MERCHANT'}
    }),
    prisma.expenseCategory.findFirst({
      where: {id: input.categoryId, workspaceId: current.workspace.id}
    }),
    prisma.paymentMethod.findFirst({
      where: {id: input.paymentMethodId, workspaceId: current.workspace.id, kind: {in: ['EXPENSE', 'BOTH']}}
    })
  ]);
  if (!supplier || !category || !method) {
    return NextResponse.json({error: 'Configurazione della spesa da banco non valida'}, {status: 409});
  }

  const isCash = method.systemRole === 'CASH';
  let bankId: number | null = null;
  if (!isCash) {
    if (!input.bankId) return NextResponse.json({error: 'Seleziona la banca di addebito'}, {status: 400});
    const bank = await prisma.bank.findFirst({
      where: {id: input.bankId, workspaceId: current.workspace.id, isFallback: false}
    });
    if (!bank) return NextResponse.json({error: 'Banca non valida'}, {status: 400});
    bankId = bank.id;
  }

  const period = yearMonthInTimeZone(current.company.timeZone, paymentDate);
  try {
    const expense = await prisma.expense.create({
      data: {
        workspaceId: current.workspace.id,
        companyId: current.company.id,
        receivedDate: paymentDate,
        dueDate: paymentDate,
        paymentDate,
        merchant: supplier.businessName,
        supplierId: supplier.id,
        categoryId: category.id,
        description: input.description || 'Spesa da banco',
        amount: input.amount,
        expenseType: 'COUNTER',
        vatRate,
        isDeclared: input.isDeductible,
        hasElectronicInvoice: false,
        invoiceStatus: 'NON_PREVISTA',
        isComplete: true,
        isRecurring: false,
        paymentStatus: 'COMPLETATO',
        paidAmount: input.amount,
        month: period.month,
        year: period.year,
        counterExpenseRequestId: input.requestId,
        payments: {
          create: {
            paymentDate,
            paymentMethodId: method.id,
            bankId,
            amount: input.amount
          }
        }
      },
      include: {payments: true}
    });
    await writeAuditLog({
      workspaceId: current.workspace.id,
      userId: current.user.id,
      action: 'CREATE',
      entityType: 'CounterExpense',
      entityId: expense.id,
      metadata: {amount: input.amount, paymentMethodId: method.id, bankId, requestId: input.requestId, description: input.description || null},
      request
    });
    return NextResponse.json({expense}, {status: 201});
  } catch (error) {
    const existing = await prisma.expense.findFirst({
      where: {
        workspaceId: current.workspace.id,
        companyId: current.company.id,
        counterExpenseRequestId: input.requestId
      }
    });
    if (existing) return NextResponse.json({expense: existing, duplicate: true});
    throw error;
  }
}
