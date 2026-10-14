import {z} from 'zod';
import {NextResponse} from 'next/server';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from './auth';
import {prisma} from './prisma';
import {ensureWorkspaceDefaults} from './workspace-defaults';
import {resolveDefaultIncomeCategory} from './income-category';
import {resolveCashRegisterBankId} from './cash-register-bank';
import {yearMonthInTimeZone} from './company-time';
import {writeAuditLog} from './audit';
import {existingReceiptLines, receiptLineSummary, receiptLinesData, receiptLineLimit} from './cash-register-lines';

const lineSchema = z.object({amount: z.number().positive().max(999999999.99), isFiscal: z.boolean(), vatRate: z.number(), description: z.string().trim().max(200).nullable().optional()});
const schema = z.object({
  lines: z.array(lineSchema).min(1).max(receiptLineLimit).optional(),
  amount: z.coerce.number().positive().max(999999999.99).optional(), isFiscal: z.boolean().optional(), vatRate: z.coerce.number().optional(),
  creditDate: z.string().datetime(), salesChannelId: z.coerce.number().int().positive(), incomeCategoryId: z.coerce.number().int().positive().optional(),
  description: z.string().trim().max(200).optional(), paymentMethodId: z.coerce.number().int().positive(),
  bankId: z.coerce.number().int().positive().optional(), requestId: z.string().uuid().optional(),
});
export async function saveCashRegisterReceipt(request: Request, id?: number) {
  const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
  if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
  const {workspace, company, user} = access.current;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || id !== undefined && (!Number.isInteger(id) || id <= 0) || !id && !parsed.data.requestId) return NextResponse.json({error: 'Dati scontrino non validi'}, {status: 400});
  const input = parsed.data;
  const lines = input.lines ?? (input.amount && input.isFiscal !== undefined && input.vatRate !== undefined ? [{amount: input.amount, isFiscal: input.isFiscal, vatRate: input.isFiscal ? input.vatRate : 0}] : []);
  let summary;
  try {summary = receiptLineSummary(lines);} catch (error) {return NextResponse.json({error: error instanceof Error ? error.message : 'Importi non validi'}, {status: 400});}
  await ensureWorkspaceDefaults(workspace.id);
  const [existing, category, customer, method, channel, bank] = await Promise.all([
    id ? prisma.income.findFirst({where: {id, workspaceId: workspace.id, companyId: company.id, incomeType: 'CASH_REGISTER'}}) : null,
    input.incomeCategoryId ? prisma.incomeCategory.findFirst({where: {id: input.incomeCategoryId, workspaceId: workspace.id}}) : resolveDefaultIncomeCategory(workspace.id),
    prisma.customer.findFirst({where: {workspaceId: workspace.id, systemRole: 'CASH_REGISTER'}}),
    prisma.paymentMethod.findFirst({where: {id: input.paymentMethodId, workspaceId: workspace.id, cashRegisterEnabled: true, kind: {in: ['INCOME', 'BOTH']}}}),
    prisma.incomeSalesChannel.findFirst({where: {id: input.salesChannelId, workspaceId: workspace.id}}),
    id && input.bankId ? prisma.bank.findFirst({where: {id: input.bankId, workspaceId: workspace.id}}) : null,
  ]);
  if (id && !existing) return NextResponse.json({error: 'Scontrino non trovato'}, {status: 404});
  if (!category || !customer || !method || !channel || id && !bank) return NextResponse.json({error: 'Completa la configurazione del registratore di cassa'}, {status: 409});
  if (summary.hasNonFiscal && method.systemRole !== 'CASH') return NextResponse.json({error: 'Gli scontrini con importi non fiscali possono essere incassati solo in contanti'}, {status: 400});
  const bankId = bank?.id ?? await resolveCashRegisterBankId(workspace.id, method, channel.id);
  if (!bankId) return NextResponse.json({error: 'Configura la banca per questo metodo e canale'}, {status: 409});
  const date = new Date(input.creditDate);
  const period = yearMonthInTimeZone(company.timeZone, date);
  const data = {
    amount: summary.amount, receiptFiscalAmount: summary.receiptFiscalAmount, receiptVatAmount: summary.receiptVatAmount,
    isFiscal: summary.isFiscal, vatRate: summary.vatRate, incomeCategoryId: category.id, description: input.description || 'Incasso da banco',
    invoiceStatus: summary.isFiscal ? 'EMESSA' : null, orderDate: date, creditDate: date, billingYear: period.year, billingMonth: period.month,
    salesChannelId: channel.id, paymentMethodId: method.id, creditBankId: bankId, isCredited: true, dueDate: null,
  };
  try {
    const receipt = await prisma.$transaction(async tx => {
      const result = id ? await tx.income.update({where: {id}, data: {...data,
        receiptLines: {deleteMany: {}, create: receiptLinesData(lines)},
        credits: {deleteMany: {}, create: {creditDate: date, paymentMethodId: method.id, bankId, amount: summary.amount}},
      }, include: {receiptLines: {orderBy: {position: 'asc'}}}}) : await tx.income.create({data: {
        ...data, workspaceId: workspace.id, companyId: company.id, customerId: customer.id, incomeType: 'CASH_REGISTER', cashRegisterRequestId: input.requestId,
        receiptLines: {create: receiptLinesData(lines)}, credits: {create: {creditDate: date, paymentMethodId: method.id, bankId, amount: summary.amount}},
      }, include: {receiptLines: {orderBy: {position: 'asc'}}}});
      await writeAuditLog({workspaceId: workspace.id, userId: user.id, action: id ? 'UPDATE' : 'CREATE', entityType: 'CashRegisterReceipt', entityId: result.id,
        metadata: {amount: summary.amount, lineCount: lines.length, requestId: input.requestId ?? null}, request}, tx);
      return result;
    });
    return NextResponse.json({receipt}, {status: id ? 200 : 201});
  } catch (error) {
    if (!id && (error as {code?: string}).code === 'P2002') {
      const stored = await prisma.income.findFirst({where: {workspaceId: workspace.id, companyId: company.id, cashRegisterRequestId: input.requestId}, include: {receiptLines: {orderBy: {position: 'asc'}}}});
      if (stored) {
        const equalLines = JSON.stringify(receiptLinesData(existingReceiptLines(stored))) === JSON.stringify(receiptLinesData(lines));
        if (!equalLines || stored.paymentMethodId !== method.id || stored.salesChannelId !== channel.id || stored.incomeCategoryId !== category.id || stored.creditDate.getTime() !== date.getTime() || stored.description !== data.description) return NextResponse.json({error: 'Questo inserimento è già stato salvato con dati diversi. Ricarica il registratore.'}, {status: 409});
        return NextResponse.json({receipt: stored, duplicate: true});
      }
    }
    return NextResponse.json({error: 'Registrazione non riuscita. Riprova senza perdere gli importi inseriti.'}, {status: 500});
  }
}
