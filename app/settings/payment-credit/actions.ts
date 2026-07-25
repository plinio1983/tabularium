'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireWorkspace } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cashCreditChannelName, paymentCreditIconOptions } from '@/lib/workspace-defaults';

const settingsPath = '/settings/payment-credit';
const methodKinds = ['INCOME', 'EXPENSE', 'BOTH'] as const;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function settingsError(code: string): never {
  redirect(`${settingsPath}?error=${encodeURIComponent(code)}`);
}

function refreshPaymentCreditPages() {
  revalidatePath('/', 'layout');
}

function validateName(formData: FormData) {
  const name = formValue(formData, 'name');
  if (!name) settingsError('invalid');
  if (name.length > 80) settingsError('name_length');
  return name;
}

function validateKind(formData: FormData) {
  const kind = formValue(formData, 'kind') || 'BOTH';
  if (!methodKinds.includes(kind as typeof methodKinds[number])) settingsError('kind_invalid');
  return kind;
}

function validateIcon(formData: FormData) {
  const icon = formValue(formData, 'icon') || null;
  if (icon && !paymentCreditIconOptions.includes(icon as typeof paymentCreditIconOptions[number])) settingsError('icon_invalid');
  return icon;
}

export async function createBankAction(formData: FormData) {
  const current = await requireWorkspace(settingsPath);
  const name = validateName(formData);
  const icon = validateIcon(formData);
  const existing = await prisma.bank.findFirst({ where: { workspaceId: current.workspace.id, name } });
  if (existing) settingsError('bank_exists');

  await prisma.bank.create({ data: { workspaceId: current.workspace.id, name, icon } });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?saved=bank_created`);
}

export async function updateBankAction(formData: FormData) {
  const current = await requireWorkspace(settingsPath);
  const id = Number(formValue(formData, 'id'));
  const name = validateName(formData);
  const icon = validateIcon(formData);
  if (!Number.isInteger(id) || id <= 0) settingsError('invalid');

  const bank = await prisma.bank.findFirst({ where: { id, workspaceId: current.workspace.id } });
  if (!bank) settingsError('bank_not_found');
  const duplicate = await prisma.bank.findFirst({ where: { workspaceId: current.workspace.id, name, NOT: { id } } });
  if (duplicate) settingsError('bank_exists');

  await prisma.bank.update({ where: { id }, data: { name, icon } });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?saved=bank_updated`);
}

export async function deleteBankAction(formData: FormData) {
  const current = await requireWorkspace(settingsPath);
  const id = Number(formValue(formData, 'id'));
  if (!Number.isInteger(id) || id <= 0) settingsError('invalid');

  const bank = await prisma.bank.findFirst({
    where: { id, workspaceId: current.workspace.id },
    include: { _count: { select: { payments: true, recurringExpenses: true, incomeCredits: true, cashRegisterPaymentMethods: true } } }
  });
  if (!bank) settingsError('bank_not_found');
  if (bank.isFallback) settingsError('cash_bank_delete');

  const usageCount = bank._count.payments + bank._count.recurringExpenses + bank._count.incomeCredits + bank._count.cashRegisterPaymentMethods;
  if (usageCount > 0) redirect(`${settingsPath}?error=in_use&usage=${usageCount}`);

  await prisma.bank.delete({ where: { id } });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?saved=bank_deleted`);
}

export async function createPaymentMethodAction(formData: FormData) {
  const current = await requireWorkspace(settingsPath);
  const name = validateName(formData);
  const kind = validateKind(formData);
  const icon = validateIcon(formData);
  const existing = await prisma.paymentMethod.findFirst({ where: { workspaceId: current.workspace.id, name } });
  if (existing) settingsError('method_exists');

  await prisma.paymentMethod.create({ data: { workspaceId: current.workspace.id, name, kind, icon } });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?saved=method_created`);
}

export async function updatePaymentMethodAction(formData: FormData) {
  const current = await requireWorkspace(settingsPath);
  const id = Number(formValue(formData, 'id'));
  const name = validateName(formData);
  const kind = validateKind(formData);
  const icon = validateIcon(formData);
  if (!Number.isInteger(id) || id <= 0) settingsError('invalid');

  const method = await prisma.paymentMethod.findFirst({ where: { id, workspaceId: current.workspace.id } });
  if (!method) settingsError('method_not_found');
  const duplicate = await prisma.paymentMethod.findFirst({ where: { workspaceId: current.workspace.id, name, NOT: { id } } });
  if (duplicate) settingsError('method_exists');

  const cashRegisterManaged = formData.get('cashRegisterManaged') === '1';
  const cashRegisterEnabled = formData.get('cashRegisterEnabled') === 'on' && (kind === 'INCOME' || kind === 'BOTH');
  const makePrimary = formData.get('cashRegisterPrimary') === 'on' && cashRegisterEnabled && method.systemRole !== 'CASH';
  let cashRegisterDefaultBankId: number | null = method.cashRegisterDefaultBankId;

  if (cashRegisterManaged) {
    if (cashRegisterEnabled) {
      if (method.systemRole === 'CASH') {
        const cashChannel = await prisma.bank.findFirst({
          where: {workspaceId: current.workspace.id, name: cashCreditChannelName}
        });
        if (!cashChannel) settingsError('cash_register_bank');
        cashRegisterDefaultBankId = cashChannel.id;
      } else {
        const bankId = Number(formValue(formData, 'cashRegisterDefaultBankId'));
        const bank = await prisma.bank.findFirst({where: {id: bankId, workspaceId: current.workspace.id}});
        if (!bank) settingsError('cash_register_bank');
        cashRegisterDefaultBankId = bank.id;
      }
    } else {
      cashRegisterDefaultBankId = null;
    }
  }

  const workspace = cashRegisterManaged ? await prisma.workspace.findUnique({
    where: {id: current.workspace.id},
    select: {cashRegisterPrimaryPaymentMethodId: true}
  }) : null;
  let replacementPrimaryId: number | null | undefined;
  if (makePrimary) replacementPrimaryId = id;
  else if (workspace?.cashRegisterPrimaryPaymentMethodId === id && !makePrimary) {
    const replacement = await prisma.paymentMethod.findFirst({
      where: {workspaceId: current.workspace.id, id: {not: id}, cashRegisterEnabled: true,
        OR: [{systemRole: null}, {systemRole: {not: 'CASH'}}], kind: {in: ['INCOME', 'BOTH']}},
      orderBy: {id: 'asc'}
    });
    replacementPrimaryId = replacement?.id ?? null;
  }

  await prisma.$transaction([
    prisma.paymentMethod.update({
      where: { id },
      data: {
        name, kind, icon,
        ...(cashRegisterManaged ? {cashRegisterEnabled, cashRegisterDefaultBankId} : {})
      }
    }),
    ...(replacementPrimaryId !== undefined ? [prisma.workspace.update({
      where: {id: current.workspace.id},
      data: {cashRegisterPrimaryPaymentMethodId: replacementPrimaryId}
    })] : [])
  ]);
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?saved=method_updated`);
}

export async function deletePaymentMethodAction(formData: FormData) {
  const current = await requireWorkspace(settingsPath);
  const id = Number(formValue(formData, 'id'));
  if (!Number.isInteger(id) || id <= 0) settingsError('invalid');

  const method = await prisma.paymentMethod.findFirst({
    where: { id, workspaceId: current.workspace.id },
    include: { _count: { select: { incomePayments: true, expensePayments: true, recurringExpenses: true, cashRegisterPrimaryForWorkspaces: true } } }
  });
  if (!method) settingsError('method_not_found');
  if (method.isFallback) settingsError('fallback_delete');
  if (method.systemRole) settingsError('system_delete');
  if (method.cashRegisterEnabled || method._count.cashRegisterPrimaryForWorkspaces) settingsError('cash_register_method_delete');

  const usageCount = method._count.incomePayments + method._count.expensePayments + method._count.recurringExpenses;
  if (usageCount > 0) redirect(`${settingsPath}?error=in_use&usage=${usageCount}`);

  await prisma.paymentMethod.delete({ where: { id } });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?saved=method_deleted`);
}
