import {counterExpenseEditSchema, counterExpenseSnapshot} from '@/lib/counter-expense-edit';
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

// Update in place: payment IDs, attachments and notes are preserved.
export async function PATCH(request: Request) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {current} = access;
  const parsed = counterExpenseEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error: parsed.error.issues[0]?.message ?? 'Dati non validi.'}, {status: 400});
  const input = parsed.data;
  try {
    await prisma.$transaction(async tx => {
      const expense = await tx.expense.findFirst({
        where: {id: input.id, workspaceId: current.workspace.id, companyId: current.company.id, expenseType: 'COUNTER'},
        include: {payments: {orderBy: {id: 'asc'}}}
      });
      if (!expense) throw new CounterEditError('Spesa da banco non trovata.', 404);
      if (counterExpenseSnapshot(expense) !== input.snapshot) throw new CounterEditError('La spesa o i pagamenti sono cambiati. Riapri il form.', 409);
      const ids = new Set(input.payments.flatMap(row => row.id ? [row.id] : []));
      if (ids.size !== expense.payments.length || expense.payments.some(row => !ids.has(row.id)) || (expense.payments.length > 0 && input.payments.some(row => !row.id))) {
        throw new CounterEditError('I pagamenti esistenti devono essere conservati.', 400);
      }
      const category = await tx.expenseCategory.findFirst({where: {id: input.categoryId, workspaceId: current.workspace.id}});
      if (!category) throw new CounterEditError('Categoria non valida.', 400);
      const rows = [];
      for (const row of input.payments) {
        const method = await tx.paymentMethod.findFirst({where: {id: row.paymentMethodId, workspaceId: current.workspace.id, kind: {in: ['EXPENSE', 'BOTH']}}});
        if (!method) throw new CounterEditError('Metodo di pagamento non valido.', 400);
        const cash = method.systemRole === 'CASH';
        if (!cash && (!row.bankId || !await tx.bank.findFirst({where: {id: row.bankId, workspaceId: current.workspace.id, isFallback: false}}))) throw new CounterEditError('Seleziona una banca valida.', 400);
        rows.push({...row, bankId: cash ? null : row.bankId, paymentDate: new Date(row.paymentDate)});
      }
      const paymentDate = new Date(input.paymentDate);
      const period = yearMonthInTimeZone(current.company.timeZone, paymentDate);
      const data = {
        amount: input.amount, categoryId: input.categoryId, description: input.description || null,
        receivedDate: paymentDate, dueDate: paymentDate, paymentDate: rows[rows.length - 1].paymentDate,
        month: period.month, year: period.year, isDeclared: input.isDeductible,
        vatRate: input.isDeductible ? input.vatRate : 0, hasElectronicInvoice: false,
        invoiceStatus: 'NON_PREVISTA' as const, paidAmount: input.amount, isComplete: true, paymentStatus: 'COMPLETATO' as const
      };
      await tx.expense.update({where: {id: expense.id}, data});
      for (const {id, ...payment} of rows) {
        if (id) await tx.expensePayment.update({where: {id}, data: payment});
        else await tx.expensePayment.create({data: {...payment, expenseId: expense.id}});
      }
      await tx.auditLog.create({data: {
        workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE', entityType: 'CounterExpense', entityId: String(expense.id),
        metadata: JSON.parse(JSON.stringify({before: expense, after: {...expense, ...data, payments: rows}}))
      }});
    }, {isolationLevel: 'Serializable'});
    return NextResponse.json({saved: true});
  } catch (error) {
    if (error instanceof CounterEditError) return NextResponse.json({error: error.message}, {status: error.status});
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') return NextResponse.json({error: 'La spesa è stata modificata contemporaneamente. Riapri il form.'}, {status: 409});
    console.error('Counter expense update failed', error);
    return NextResponse.json({error: 'Salvataggio non riuscito. Nessuna modifica salvata.'}, {status: 500});
  }
}

class CounterEditError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
