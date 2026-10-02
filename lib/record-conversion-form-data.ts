import {prisma} from '@/lib/prisma';
import {canConvertExpense, canConvertIncome, type ExpenseConversionType} from '@/lib/record-conversion';
import {conversionExpenseInclude, conversionIncomeInclude, conversionSnapshot} from '@/lib/record-conversion-service';
import {orderBanks, orderExpenseCategories, orderPaymentMethods} from '@/lib/workspace-defaults';
import type {RecordConversionFormProps} from '@/components/RecordConversionForm';

export class ConversionFormDataError extends Error {
    constructor(message: string, public status: number) {super(message);}
}

export async function loadRecordConversionForm(kind: 'expenses' | 'incomes', id: number, current: {workspace: {id: number}; company: {id: number; primaryBankId: number | null}}): Promise<RecordConversionFormProps> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new ConversionFormDataError('Record non valido.', 404);
    const where = {id, workspaceId: current.workspace.id, companyId: current.company.id};
    const returnHref = `/${kind}/${id}`;
    const [banks, methods] = await Promise.all([
        prisma.bank.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findMany({where: {workspaceId: current.workspace.id}})
    ]);
    const bankOptions = orderBanks(banks).map(bank => ({id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback, isPrimary: bank.id === current.company.primaryBankId}));
    const methodOptions = orderPaymentMethods(methods, kind === 'expenses' ? 'EXPENSE' : 'INCOME').map(method => ({id: method.id, name: method.name, icon: method.icon, kind: method.kind, systemRole: method.systemRole, isExpenseDefault: method.isExpenseDefault, isIncomeDefault: method.isIncomeDefault}));
    if (kind === 'expenses') {
        const source = await prisma.expense.findFirst({where, include: conversionExpenseInclude});
        if (!source) throw new ConversionFormDataError('Record non trovato.', 404);
        if (!canConvertExpense(source)) throw new ConversionFormDataError('La conversione non è disponibile per questo record.', 400);
        const [categories, suppliers, employees] = await Promise.all([
            prisma.expenseCategory.findMany({where: {workspaceId: current.workspace.id}}),
            prisma.supplier.findMany({where: {workspaceId: current.workspace.id, systemRole: null}, orderBy: {businessName: 'asc'}}),
            prisma.employee.findMany({where: {workspaceId: current.workspace.id, companyId: current.company.id, status: 'ACTIVE'}, orderBy: [{lastName: 'asc'}, {firstName: 'asc'}]})
        ]);
        return {kind: 'expenses', id, sourceType: source.expenseType as ExpenseConversionType, snapshot: conversionSnapshot(source), returnHref,
            formProps: {banks: bankOptions, paymentMethods: methodOptions,
                categories: orderExpenseCategories(categories).map(category => ({id: category.id, code: category.code, name: category.name, icon: category.icon})),
                suppliers: suppliers.map(supplier => ({id: supplier.id, businessName: supplier.businessName, alias: supplier.alias, defaultExpenseCategoryId: supplier.defaultExpenseCategoryId, defaultVatRate: supplier.defaultVatRate?.toString()})),
                employees: employees.map(employee => ({id: employee.id, firstName: employee.firstName, lastName: employee.lastName, status: employee.status})),
                initialExpense: {
                    isDeclared: source.isDeclared, vatRate: source.vatRate.toString(),
                    id: source.id, expenseType: source.expenseType, amount: source.amount.toString(),
                    receivedDate: source.receivedDate?.toISOString(), dueDate: source.dueDate?.toISOString(),
                    categoryId: source.categoryId, description: source.description, notes: source.notes,
                    month: source.month, year: source.year, paymentStatus: source.paymentStatus,
                    payments: source.payments.map(payment => ({id: payment.id, amount: payment.amount.toString(), paymentDate: payment.paymentDate?.toISOString(), paymentMethodId: payment.paymentMethodId, bankId: payment.bankId})),
                    attachments: source.attachments.map(attachment => ({id: attachment.id, originalName: attachment.originalName, type: attachment.type, sizeBytes: attachment.sizeBytes}))
                }}};
    }
    const source = await prisma.income.findFirst({where, include: conversionIncomeInclude});
    if (!source) throw new ConversionFormDataError('Record non trovato.', 404);
    if (!canConvertIncome(source)) throw new ConversionFormDataError('La conversione non è disponibile per questo record.', 400);
    const [customers, salesChannels] = await Promise.all([
        prisma.customer.findMany({where: {workspaceId: current.workspace.id, systemRole: null}, orderBy: {businessName: 'asc'}}),
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]})
    ]);
    return {kind: 'incomes', id, sourceType: source.incomeType, snapshot: conversionSnapshot(source), returnHref,
        formProps: {banks: bankOptions, paymentMethods: methodOptions,
            customers: customers.map(customer => ({id: customer.id, businessName: customer.businessName, alias: customer.alias, defaultSalesChannelId: customer.defaultSalesChannelId})),
            salesChannels: salesChannels.map(channel => ({id: channel.id, code: channel.code, name: channel.name, icon: channel.icon, isDefault: channel.isDefault})),
            initialIncome: {
                id: source.id, customerId: source.customerId, salesChannelId: source.salesChannelId, amount: source.amount.toString(),
                orderDate: source.orderDate?.toISOString(), dueDate: source.dueDate?.toISOString(), creditDate: source.creditDate.toISOString(),
                description: source.description, notes: source.notes, billingMonth: source.billingMonth, billingYear: source.billingYear,
                isCredited: source.isCredited, isFiscal: source.isFiscal, invoiceStatus: source.invoiceStatus, vatRate: source.vatRate.toString(),
                paymentMethodId: source.paymentMethodId, creditBankId: source.creditBankId,
                credits: source.credits.map(credit => ({id: credit.id, amount: credit.amount.toString(), creditDate: credit.creditDate.toISOString(), paymentMethodId: credit.paymentMethodId, bankId: credit.bankId})),
                attachments: source.attachments.map(attachment => ({id: attachment.id, originalName: attachment.originalName, type: attachment.type, sizeBytes: attachment.sizeBytes}))
            }}};
}
