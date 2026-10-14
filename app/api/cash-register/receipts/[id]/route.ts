import {saveCashRegisterReceipt} from '@/lib/cash-register-save';
import {existingReceiptLines, receiptLineSummary} from '@/lib/cash-register-lines';
import {NextResponse} from 'next/server';
import {getWorkspaceApiAccess, getWorkspaceContext, workspaceOperationalRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {writeAuditLog} from '@/lib/audit';

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
    const current = await getWorkspaceContext();
    if (!current) return NextResponse.json({error: 'Autenticazione richiesta'}, {status: 401});
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({error: 'ID non valido'}, {status: 400});
    const receipt = await prisma.income.findFirst({
        where: {id, workspaceId: current.workspace.id, companyId: current.company.id, incomeType: 'CASH_REGISTER'},
        select: {
            id: true, description: true, amount: true, creditDate: true, isFiscal: true, vatRate: true,
            incomeCategory: {select: {name: true}}, receiptLines: {orderBy: {position: 'asc'}},
            salesChannelRef: {select: {name: true}},
            paymentMethodRef: {select: {name: true}},
            creditBank: {select: {name: true}}
        }
    });
    if (!receipt) return NextResponse.json({error: 'Scontrino non trovato'}, {status: 404});
    return NextResponse.json({receipt: {
        id: receipt.id, description: receipt.description, amount: Number(receipt.amount),
        creditDate: receipt.creditDate.toISOString(), isFiscal: receipt.isFiscal, vatRate: Number(receipt.vatRate),
        salesChannel: receipt.salesChannelRef.name, paymentMethod: receipt.paymentMethodRef.name,
        bank: receipt.creditBank.name, category: receipt.incomeCategory.name,
        lines: existingReceiptLines(receipt), mixed: receiptLineSummary(existingReceiptLines(receipt)).mixed
    }}, {headers: {'Cache-Control': 'no-store'}});
}

export async function PATCH(request: Request, {params}: {params: Promise<{id: string}>}) {
    return saveCashRegisterReceipt(request, Number((await params).id));
}

export async function DELETE(request: Request, {params}: { params: Promise<{ id: string }> }) {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    const current = access.current;
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({error: 'ID non valido'}, {status: 400});
    const result = await prisma.income.deleteMany({
        where: {id, workspaceId: current.workspace.id, companyId: current.company.id, incomeType: 'CASH_REGISTER'}
    });
    if (!result.count) return NextResponse.json({error: 'Scontrino non trovato'}, {status: 404});
    await writeAuditLog({
        workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE',
        entityType: 'CashRegisterReceipt', entityId: id, request
    });
    return NextResponse.json({ok: true});
}
