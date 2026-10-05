import {createHash} from 'node:crypto';
import {z} from 'zod';
import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import type {Prisma} from '@/generated/prisma/client';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {resolveExpenseAmounts, resolvePayrollPeriod} from '@/lib/payroll-expense';
import {assertCoveredAmount, canConvertExpense, canConvertIncome, conversionLabels} from '@/lib/record-conversion';
import {yearMonthInTimeZone} from '@/lib/company-time';

export const conversionExpenseInclude = {payments: {orderBy: {id: 'asc' as const}}, attachments: {orderBy: {id: 'asc' as const}}};
export const conversionIncomeInclude = {credits: {orderBy: {id: 'asc' as const}}, attachments: {orderBy: {id: 'asc' as const}}};
export type ConversionExpense = Prisma.ExpenseGetPayload<{include: typeof conversionExpenseInclude}>;
export type ConversionIncome = Prisma.IncomeGetPayload<{include: typeof conversionIncomeInclude}>;
type Tx = Prisma.TransactionClient;
export function conversionSnapshot(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
class ConversionError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
function validateDomain<T>(check: () => T): T {
    try { return check(); }
    catch (error) { throw new ConversionError(error instanceof Error ? error.message : 'Dati non validi per la conversione.'); }
}
const money = z.preprocess(value => typeof value === 'string' ? value.replace(',', '.') : value,
    z.coerce.number().finite().min(0).max(9999999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Usa al massimo due decimali'));
const optionalMoney = z.preprocess(value => value === '' || value == null ? undefined : value, money.optional());
const bool = z.preprocess(value => value === 'true' || value === 'on' || value === true, z.boolean());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Data non valida');
const optionalDate = z.preprocess(value => value === '' || value == null ? undefined : value, date.optional());
const optionalId = z.preprocess(value => value === '' || value == null ? null : value, z.coerce.number().int().positive().nullable());
const period = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/);
const common = {amount: money, description: z.string().trim().max(2000).default(''), notes: z.string().max(20000).default(''), vatRate: z.coerce.number().finite().min(0).max(100)};
const expenseSchema = z.object({
    ...common, targetType: z.enum(['STANDARD', 'PAYROLL', 'TAX_CONTRIBUTION']),
    description: z.string().trim().min(1, 'Inserisci la descrizione').max(2000),
    supplierId: optionalId, employeeId: optionalId, taxAuthorityId: optionalId, categoryId: optionalId,
    receivedDate: optionalDate, dueDate: optionalDate, billingPeriod: period,
    payrollNetAmount: optionalMoney, payrollExtraCompensation: optionalMoney, payrollGrossAmount: optionalMoney, payrollEmployerCost: optionalMoney,
    payrollPeriodStart: optionalDate, payrollPeriodEnd: optionalDate,
    isDeclared: bool, hasElectronicInvoice: bool, affectsFiscalProfit: bool,
    invoiceStatus: z.enum(['NON_PREVISTA', 'IN_ATTESA', 'INVIATA_SDI', 'CONTESTAZIONE', 'PARZIALE', 'RICEVUTA']).default('NON_PREVISTA')
});
const incomeSchema = z.object({
    ...common, targetType: z.enum(['STANDARD', 'CASH_REGISTER']), customerId: optionalId,
    salesChannelId: z.coerce.number().int().positive(), orderDate: optionalDate, dueDate: optionalDate,
    billingPeriod: period.optional(), isFiscal: bool,
    invoiceStatus: z.preprocess(value => value === '' ? null : value, z.enum(['NON_INVIATA', 'PARZIALE', 'EMESSA']).nullable().optional())
});

async function expenseData(tx: Tx, source: ConversionExpense, raw: Record<string, FormDataEntryValue>, workspaceId: number, companyId: number) {
    if (!canConvertExpense(source)) throw new ConversionError('Questo tipo di spesa non può essere convertito.');
    if (raw.targetType === 'COUNTER') return counterExpenseData(tx, source, raw, workspaceId, companyId);
    const input = expenseSchema.parse(raw);
    if (input.targetType === source.expenseType) throw new ConversionError('Seleziona un tipo diverso da quello attuale.');
    const payroll = input.targetType === 'PAYROLL';
    const tax = input.targetType === 'TAX_CONTRIBUTION';
    const supplier = !payroll && !tax && input.supplierId ? await tx.supplier.findFirst({where: {id: input.supplierId, workspaceId, systemRole: null}}) : null;
    const employee = payroll && input.employeeId ? await tx.employee.findFirst({where: {id: input.employeeId, workspaceId, companyId, status: 'ACTIVE'}}) : null;
    const authority = tax && input.taxAuthorityId ? await tx.taxAuthority.findFirst({where: {id: input.taxAuthorityId, workspaceId, isActive: true}}) : null;
    if (payroll ? !employee : tax ? !authority : !supplier) throw new ConversionError(payroll ? 'Seleziona un dipendente attivo della società.' : tax ? 'Seleziona un ente valido.' : 'Seleziona un fornitore valido.');
    if (input.categoryId && !await tx.expenseCategory.findFirst({where: {id: input.categoryId, workspaceId}})) throw new ConversionError('Categoria non valida.');
    const amounts = validateDomain(() => resolveExpenseAmounts({isPayroll: payroll, ...input}));
    money.parse(amounts.amount);
    const dates = validateDomain(() => resolvePayrollPeriod({isPayroll: payroll, start: input.payrollPeriodStart, end: input.payrollPeriodEnd, dueDate: input.dueDate}));
    const paid = source.payments.length ? source.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) : Number(source.paidAmount);
    validateDomain(() => assertCoveredAmount(amounts.amount, paid));
    const complete = amounts.amount > 0 && paid >= amounts.amount - 0.005;
    const declared = !payroll && !tax && input.isDeclared;
    const [year, month] = input.billingPeriod.split('-').map(Number);
    const data = {
        expenseType: input.targetType, merchant: employee ? `${employee.lastName} ${employee.firstName}` : authority?.name ?? supplier!.businessName,
        supplierId: supplier?.id ?? null, employeeId: employee?.id ?? null, taxAuthorityId: authority?.id ?? null, categoryId: input.categoryId,
        description: input.description, notes: input.notes || null, ...amounts, ...dates,
        payrollGrossAmount: payroll ? input.payrollGrossAmount ?? null : null, payrollEmployerCost: payroll ? input.payrollEmployerCost ?? null : null,
        receivedDate: payroll ? dates.payrollPeriodEnd : input.receivedDate ? new Date(input.receivedDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null, month, year,
        vatRate: declared ? input.vatRate : 0, isDeclared: declared, hasElectronicInvoice: declared && input.hasElectronicInvoice,
        invoiceStatus: declared ? input.invoiceStatus === 'INVIATA_SDI' ? 'RICEVUTA' as const : input.invoiceStatus : 'NON_PREVISTA' as const,
        affectsFiscalProfit: payroll || (tax && input.affectsFiscalProfit),
        paidAmount: paid, isComplete: complete,
        paymentStatus: complete ? 'COMPLETATO' as const : paid > 0 ? 'PAGATO_PARZIALMENTE' as const : 'DA_PAGARE' as const
    };
    return data;
}

const counterConversionSchema = z.object({
    amount: money.refine(value => value > 0 && value <= 999999999.99, 'Importo non valido'),
    categoryId: z.coerce.number().int().positive(), description: z.string().trim().max(2000).default(''),
    isDeclared: bool, vatRate: z.coerce.number(), paymentDate: z.string().datetime(),
    paymentMethodId: z.coerce.number().int().positive(), bankId: optionalId
});
async function counterExpenseData(tx: Tx, source: ConversionExpense, raw: Record<string, FormDataEntryValue>, workspaceId: number, companyId: number) {
    if (source.expenseType === 'COUNTER') throw new ConversionError('Seleziona un tipo diverso da quello attuale.');
    const input = counterConversionSchema.parse(raw);
    const first = source.payments[0];
    const generated = Boolean(source.isRecurring || source.recurringExpenseId);
    if (generated && (source.payments.length !== 1
        || Math.abs(Number(first.amount) - input.amount) > 0.005
        || Math.abs(Number(source.amount) - input.amount) > 0.005)) {
        throw new ConversionError('Per convertire una spesa generata da una ricorrenza in una spesa da banco serve un unico pagamento già registrato per l’intero importo. La conversione non crea o modifica pagamenti.');
    }
    const paymentDate = first ? first.paymentDate : new Date(input.paymentDate);
    if (!paymentDate) throw new ConversionError('Il primo pagamento non ha una data. Completa il pagamento prima della conversione.');
    const method = await tx.paymentMethod.findFirst({where: {id: first ? first.paymentMethodId : input.paymentMethodId, workspaceId, kind: {in: ['EXPENSE', 'BOTH']}}});
    if (!method) throw new ConversionError('Metodo di pagamento non valido.');
    const bankId = method.systemRole === 'CASH' ? null : first ? first.bankId : input.bankId;
    if (method.systemRole !== 'CASH' && (!bankId || !await tx.bank.findFirst({where: {id: bankId, workspaceId, isFallback: false}}))) throw new ConversionError('Seleziona una banca valida.');
    const supplier = await tx.supplier.findFirst({where: {workspaceId, systemRole: 'COUNTER_MERCHANT'}});
    if (!supplier) throw new ConversionError('Configurazione della spesa da banco non disponibile.');
    if (!await tx.expenseCategory.findFirst({where: {id: input.categoryId, workspaceId}})) throw new ConversionError('Categoria non valida.');
    if (input.isDeclared && ![0, 4, 10, 22].includes(input.vatRate)) throw new ConversionError('Aliquota IVA non valida.');
    const company = await tx.company.findFirst({where: {id: companyId, workspaceId}});
    if (!company) throw new ConversionError('Società non disponibile.');
    const period = yearMonthInTimeZone(company.timeZone, paymentDate);
    return {expenseType: 'COUNTER' as const, amount: input.amount, merchant: supplier.businessName, supplierId: supplier.id,
        employeeId: null, taxAuthorityId: null, categoryId: input.categoryId, description: input.description || 'Spesa da banco',
        payrollNetAmount: null, payrollExtraCompensation: null, payrollGrossAmount: null, payrollEmployerCost: null,
        payrollPeriodStart: null, payrollPeriodEnd: null, receivedDate: paymentDate, dueDate: paymentDate, paymentDate,
        ...period, isDeclared: input.isDeclared, vatRate: input.isDeclared ? input.vatRate : 0,
        hasElectronicInvoice: false, invoiceStatus: 'NON_PREVISTA' as const, affectsFiscalProfit: false,
        paidAmount: input.amount, isComplete: true, paymentStatus: 'COMPLETATO' as const,
        ...(generated ? {} : {payments: first ? {update: {where: {id: first.id}, data: {amount: input.amount, bankId}},
            deleteMany: {id: {in: source.payments.slice(1).map(payment => payment.id)}}}
            : {create: {amount: input.amount, paymentDate, paymentMethodId: method.id, bankId}}})
    };
}

async function incomeData(tx: Tx, source: ConversionIncome, raw: Record<string, FormDataEntryValue>, workspaceId: number, timeZone: string) {
    if (!canConvertIncome(source)) throw new ConversionError('Questo tipo di incasso non può essere convertito.');
    const input = incomeSchema.parse(raw);
    if (input.targetType === source.incomeType) throw new ConversionError('Seleziona un tipo diverso da quello attuale.');
    if (!await tx.incomeSalesChannel.findFirst({where: {id: input.salesChannelId, workspaceId}})) throw new ConversionError('Canale di vendita non valido.');
    const total = source.credits.length ? source.credits.reduce((sum, credit) => sum + Number(credit.amount), 0) : source.isCredited ? Number(source.amount) : 0;
    validateDomain(() => assertCoveredAmount(input.amount, total));
    if (input.targetType === 'CASH_REGISTER') {
        if (input.amount > 999999999.99 || input.description.length > 200) throw new ConversionError('Lo scontrino ammette al massimo 999.999.999,99 € e una descrizione di 200 caratteri.');
        const credit = source.credits[0];
        if (source.credits.length !== 1 || input.amount <= 0 || Math.abs(Number(credit.amount) - input.amount) > 0.005 || Math.abs(Number(source.amount) - input.amount) > 0.005) {
            throw new ConversionError('Per ottenere uno scontrino serve un unico accredito già registrato per l’intero importo. La conversione non crea o modifica accrediti.');
        }
        const method = await tx.paymentMethod.findFirst({where: {id: credit.paymentMethodId, workspaceId, cashRegisterEnabled: true, kind: {in: ['INCOME', 'BOTH']}}});
        if (!method) throw new ConversionError('Il metodo dell’accredito non è abilitato alla cassa.');
        if (!input.isFiscal && method.systemRole !== 'CASH') throw new ConversionError('Uno scontrino non fiscale richiede un accredito in contanti.');
        if (![0, 4, 10, 22].includes(input.vatRate)) throw new ConversionError('Aliquota IVA non disponibile per gli scontrini.');
        const rule = method.systemRole === 'CASH' ? null : await tx.cashRegisterBankRule.findFirst({where: {workspaceId, paymentMethodId: method.id, salesChannelId: input.salesChannelId, bank: {workspaceId}}});
        const bankId = rule?.bankId ?? method.cashRegisterDefaultBankId;
        if (!bankId || bankId !== credit.bankId || !await tx.bank.findFirst({where: {id: bankId, workspaceId}})) throw new ConversionError('Il conto dell’accredito non corrisponde al conto configurato per questo metodo e canale di cassa.');
        const customer = await tx.customer.findFirst({where: {workspaceId, systemRole: 'CASH_REGISTER'}});
        const category = await tx.incomeCategory.findFirst({where: {workspaceId, code: 'DEFAULT'}})
            ?? await tx.incomeCategory.findFirst({where: {workspaceId, code: 'B2C'}})
            ?? await tx.incomeCategory.findFirst({where: {workspaceId}, orderBy: {id: 'asc'}});
        if (!customer || !category) throw new ConversionError('Completa la configurazione della cassa prima di convertire.');
        const {month, year} = yearMonthInTimeZone(timeZone, credit.creditDate);
        return {incomeType: input.targetType, customerId: customer.id, incomeCategoryId: category.id,
            salesChannelId: input.salesChannelId, amount: input.amount, description: input.description || 'Incasso da banco', notes: input.notes || null,
            paymentMethodId: method.id, creditBankId: bankId, creditDate: credit.creditDate, orderDate: credit.creditDate, dueDate: null,
            billingMonth: month, billingYear: year, isCredited: true, isFiscal: input.isFiscal,
            invoiceStatus: input.isFiscal ? 'EMESSA' : null, vatRate: input.isFiscal ? input.vatRate : 0};
    }
    const customer = input.customerId ? await tx.customer.findFirst({where: {id: input.customerId, workspaceId, systemRole: null}}) : null;
    if (!customer) throw new ConversionError('Seleziona un cliente valido per l’incasso singolo.');
    if (!input.orderDate || !input.dueDate || !input.billingPeriod) throw new ConversionError('Completa le date e il mese di competenza.');
    const [year, month] = input.billingPeriod.split('-').map(Number);
    return {incomeType: input.targetType, customerId: customer.id, salesChannelId: input.salesChannelId,
        amount: input.amount, description: input.description || null, notes: input.notes || null,
        orderDate: new Date(input.orderDate), dueDate: new Date(input.dueDate), billingMonth: month, billingYear: year,
        isCredited: input.amount > 0 && total >= input.amount - 0.005, isFiscal: input.isFiscal,
        invoiceStatus: input.isFiscal ? input.invoiceStatus ?? 'NON_INVIATA' : null, vatRate: input.isFiscal ? input.vatRate : 0};
}

const fieldLabels: Record<string, string> = {
    expenseType: 'Tipo spesa', incomeType: 'Tipo incasso', merchant: 'Soggetto', supplierId: 'Fornitore', employeeId: 'Dipendente', taxAuthorityId: 'Ente',
    categoryId: 'Categoria spesa', customerId: 'Cliente', incomeCategoryId: 'Categoria incasso', salesChannelId: 'Canale di vendita',
    amount: 'Importo', description: 'Descrizione', notes: 'Note', payrollNetAmount: 'Netto busta paga', payrollExtraCompensation: 'Compensi extra',
    payrollGrossAmount: 'Lordo cedolino', payrollEmployerCost: 'Costo aziendale', payrollPeriodStart: 'Inizio periodo lavorato', payrollPeriodEnd: 'Fine periodo lavorato',
    receivedDate: 'Data ricezione', dueDate: 'Scadenza', month: 'Mese competenza', year: 'Anno competenza', billingMonth: 'Mese competenza', billingYear: 'Anno competenza',
    vatRate: 'IVA (%)', isDeclared: 'Fiscale', isFiscal: 'Fiscale', hasElectronicInvoice: 'Fattura elettronica', invoiceStatus: 'Stato fattura',
    affectsFiscalProfit: 'Incide sul risultato fiscale', paidAmount: 'Pagato', isComplete: 'Completata', paymentStatus: 'Stato pagamento',
    paymentDate: 'Data pagamento', paymentMethodId: 'Metodo accredito', creditBankId: 'Conto accredito', creditDate: 'Data accredito', orderDate: 'Data ordine', isCredited: 'Interamente accreditato'
};
const statusLabels: Record<string, string> = {
    NON_PREVISTA: 'Non prevista', IN_ATTESA: 'In attesa', RICEVUTA: 'Ricevuta', INVIATA_SDI: 'Inviata a SDI',
    CONTESTAZIONE: 'In contestazione', PARZIALE: 'Parziale', NON_INVIATA: 'Non inviata', EMESSA: 'Emessa',
    COMPLETATO: 'Completato', DA_PAGARE: 'Da pagare', PAGATO_PARZIALMENTE: 'Pagato parzialmente'
};
function display(value: unknown, key = '') {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sì' : 'No';
    if (value instanceof Date) return value.toLocaleDateString('it-IT', {timeZone: 'UTC'});
    const text = String(value);
    if (['amount', 'payrollNetAmount', 'payrollExtraCompensation', 'payrollGrossAmount', 'payrollEmployerCost', 'paidAmount'].includes(key)) {
        return new Intl.NumberFormat('it-IT', {style: 'currency', currency: 'EUR'}).format(Number(value));
    }
    return conversionLabels[text] ?? statusLabels[text] ?? text;
}
async function displayField(tx: Tx, workspaceId: number, key: string, value: unknown) {
    if (value == null) return '—';
    const where = {id: Number(value), workspaceId};
    switch (key) {
        case 'customerId': return (await tx.customer.findFirst({where}))?.businessName ?? 'Cliente non disponibile';
        case 'categoryId': return (await tx.expenseCategory.findFirst({where}))?.name ?? 'Categoria non disponibile';
        case 'incomeCategoryId': return (await tx.incomeCategory.findFirst({where}))?.name ?? 'Categoria non disponibile';
        case 'salesChannelId': return (await tx.incomeSalesChannel.findFirst({where}))?.name ?? 'Canale non disponibile';
        case 'paymentMethodId': return (await tx.paymentMethod.findFirst({where}))?.name ?? 'Metodo non disponibile';
        case 'creditBankId': return (await tx.bank.findFirst({where}))?.name ?? 'Conto non disponibile';
        default: return display(value, key);
    }
}
export async function handleRecordConversion(kind: 'expenses' | 'incomes', request: Request, id: number) {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({error: 'Record non valido.'}, {status: 404});
    const {current} = access;
    try {
        const form = await request.formData();
        const raw = Object.fromEntries(form.entries());
        const result = await prisma.$transaction(async tx => {
            const where = {id, workspaceId: current.workspace.id, companyId: current.company.id};
            const source = kind === 'expenses'
                ? await tx.expense.findFirst({where, include: conversionExpenseInclude})
                : await tx.income.findFirst({where, include: conversionIncomeInclude});
            if (!source) throw new ConversionError('Record non trovato.', 404);
            const snapshot = conversionSnapshot(source);
            if (raw.snapshot !== snapshot) throw new ConversionError('Il record o i suoi collegamenti sono cambiati. Ricarica la pagina e ripeti la conversione.', 409);
            const data = kind === 'expenses'
                ? await expenseData(tx, source as ConversionExpense, raw, current.workspace.id, current.company.id)
                : await incomeData(tx, source as ConversionIncome, raw, current.workspace.id, current.company.timeZone);
            const counter = kind === 'expenses' && 'expenseType' in data && data.expenseType === 'COUNTER';
            const payments = counter ? (source as ConversionExpense).payments : [];
            const warnings = counter && payments.length > 1 ? [`La spesa contiene ${payments.length} pagamenti. I ${payments.length - 1} pagamenti successivi al primo saranno eliminati e l’importo del primo sarà impostato a ${display(data.amount, 'amount')}, pari all’importo totale della spesa.`] : [];
            const generated = kind === 'expenses'
                ? Boolean((source as ConversionExpense).isRecurring || (source as ConversionExpense).recurringExpenseId)
                : Boolean((source as ConversionIncome).recurringIncomeId);
            if (generated) warnings.push('La conversione riguarda solo questo movimento. Il collegamento alla ricorrenza rimane invariato e le prossime occorrenze manterranno il tipo della ricorrenza.');
            const reviewToken = conversionSnapshot({snapshot, data});
            if (raw.confirmed === 'true') {
                if (raw.reviewToken !== reviewToken) throw new ConversionError('I dati sono cambiati: verifica nuovamente il riepilogo.', 409);
                if (kind === 'expenses') await tx.expense.update({where, data: data as Prisma.ExpenseUncheckedUpdateInput});
                else await tx.income.update({where, data: data as Prisma.IncomeUncheckedUpdateInput});
                await tx.auditLog.create({data: {workspaceId: current.workspace.id, userId: current.user.id,
                    action: 'UPDATE', entityType: kind === 'expenses' ? 'Expense' : 'Income', entityId: String(id),
                    metadata: JSON.parse(JSON.stringify({operation: 'convert_type', before: source, after: counter ? await tx.expense.findFirst({where, include: conversionExpenseInclude}) : {...source, ...data}})),
                    userAgent: request.headers.get('user-agent')?.slice(0, 500) || null}});
                return {saved: true};
            }
            const before = source as unknown as Record<string, unknown>;
            const changes = await Promise.all(Object.entries(data)
                .filter(([key, value]) => !['supplierId', 'employeeId', 'taxAuthorityId', 'payments'].includes(key) && display(before[key], key) !== display(value, key))
                .map(async ([key, value]) => ({label: fieldLabels[key] ?? key,
                    before: await displayField(tx, current.workspace.id, key, before[key]),
                    after: await displayField(tx, current.workspace.id, key, value)})));
            if (counter && !generated) changes.push({label: 'Pagamenti', before: `${payments.length} pagamenti; primo: ${payments.length ? display(payments[0].amount, 'amount') : '—'}`,
                after: `Un pagamento di ${display(data.amount, 'amount')}`});
            return {saved: false, reviewToken, changes, warnings};
        }, {isolationLevel: 'Serializable', timeout: 15000});
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof ConversionError) return NextResponse.json({error: error.message}, {status: error.status});
        if (error instanceof z.ZodError) return NextResponse.json({error: 'Controlla i campi obbligatori e il formato dei valori.', fields: error.flatten()}, {status: 400});
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') return NextResponse.json({error: 'Il record è stato modificato contemporaneamente. Ricarica e riprova.'}, {status: 409});
        console.error('Record conversion failed', error);
        return NextResponse.json({error: 'Impossibile completare la conversione. Nessuna modifica salvata.'}, {status: 500});
    }
}
