import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {canConvertExpense, canConvertIncome, type ExpenseConversionType} from '@/lib/record-conversion';
import {conversionExpenseInclude, conversionIncomeInclude, conversionSnapshot} from '@/lib/record-conversion-service';
import {orderBanks, orderExpenseCategories, orderPaymentMethods} from '@/lib/workspace-defaults';
import RecordConversionForm from '@/components/RecordConversionForm';

export default async function RecordConversionPage({kind, id, returnHref: requestedReturnHref}: {kind: 'expenses' | 'incomes'; id: number; returnHref?: string}) {
    const current = await requireWorkspaceRole(workspaceOperationalRoles, `/${kind}/${id}/convert`);
    if (!Number.isSafeInteger(id) || id <= 0) notFound();
    const where = {id, workspaceId: current.workspace.id, companyId: current.company.id};
    const returnHref = requestedReturnHref ?? `/${kind}/${id}`;
    const [banks, methods] = await Promise.all([
        prisma.bank.findMany({where: {workspaceId: current.workspace.id}}),
        prisma.paymentMethod.findMany({where: {workspaceId: current.workspace.id}})
    ]);
    const bankOptions = orderBanks(banks).map(bank => ({id: bank.id, name: bank.name, icon: bank.icon, isFallback: bank.isFallback, isPrimary: bank.id === current.company.primaryBankId}));
    const methodOptions = orderPaymentMethods(methods, kind === 'expenses' ? 'EXPENSE' : 'INCOME').map(method => ({id: method.id, name: method.name, icon: method.icon, kind: method.kind, systemRole: method.systemRole, isExpenseDefault: method.isExpenseDefault, isIncomeDefault: method.isIncomeDefault}));
    if (kind === 'expenses') {
        const source = await prisma.expense.findFirst({where, include: conversionExpenseInclude});
        if (!source) notFound();
        if (!canConvertExpense(source)) return <Unavailable href={returnHref}/>;
        const [categories, suppliers, employees] = await Promise.all([
            prisma.expenseCategory.findMany({where: {workspaceId: current.workspace.id}}),
            prisma.supplier.findMany({where: {workspaceId: current.workspace.id, systemRole: null}, orderBy: {businessName: 'asc'}}),
            prisma.employee.findMany({where: {workspaceId: current.workspace.id, companyId: current.company.id, status: 'ACTIVE'}, orderBy: [{lastName: 'asc'}, {firstName: 'asc'}]})
        ]);
        return <RecordConversionForm kind="expenses" id={id} sourceType={source.expenseType as ExpenseConversionType} snapshot={conversionSnapshot(source)} returnHref={returnHref}
            formProps={{banks: bankOptions, paymentMethods: methodOptions,
                categories: orderExpenseCategories(categories).map(category => ({id: category.id, code: category.code, name: category.name, icon: category.icon})),
                suppliers: suppliers.map(supplier => ({id: supplier.id, businessName: supplier.businessName, alias: supplier.alias, defaultExpenseCategoryId: supplier.defaultExpenseCategoryId, defaultVatRate: supplier.defaultVatRate?.toString()})),
                employees: employees.map(employee => ({id: employee.id, firstName: employee.firstName, lastName: employee.lastName, status: employee.status})),
                initialExpense: {
                    id: source.id, expenseType: source.expenseType, amount: source.amount.toString(),
                    receivedDate: source.receivedDate?.toISOString(), dueDate: source.dueDate?.toISOString(),
                    categoryId: source.categoryId, description: source.description, notes: source.notes,
                    month: source.month, year: source.year, paymentStatus: source.paymentStatus,
                    payments: source.payments.map(payment => ({id: payment.id, amount: payment.amount.toString(), paymentDate: payment.paymentDate?.toISOString(), paymentMethodId: payment.paymentMethodId, bankId: payment.bankId})),
                    attachments: source.attachments.map(attachment => ({id: attachment.id, originalName: attachment.originalName, type: attachment.type, sizeBytes: attachment.sizeBytes}))
                }}}/>;
    }
    const source = await prisma.income.findFirst({where, include: conversionIncomeInclude});
    if (!source) notFound();
    if (!canConvertIncome(source)) return <Unavailable href={returnHref}/>;
    const [customers, salesChannels] = await Promise.all([
        prisma.customer.findMany({where: {workspaceId: current.workspace.id, systemRole: null}, orderBy: {businessName: 'asc'}}),
        prisma.incomeSalesChannel.findMany({where: {workspaceId: current.workspace.id}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]})
    ]);
    return <RecordConversionForm kind="incomes" id={id} sourceType={source.incomeType} snapshot={conversionSnapshot(source)} returnHref={returnHref}
        formProps={{banks: bankOptions, paymentMethods: methodOptions,
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
            }}}/>;
}

function Unavailable({href}: {href: string}) {
    return <div className="card"><h2>Conversione non disponibile</h2><p>Le ricorrenze e le spese di tipo Saldo IVA o Da banco non sono convertibili.</p><Link className="btn btn-md btn-default" href={href}>Torna al dettaglio</Link></div>;
}
