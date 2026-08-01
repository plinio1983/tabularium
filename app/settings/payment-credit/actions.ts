'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cashCreditChannelName, paymentCreditIconOptions } from '@/lib/workspace-defaults';

const settingsPath = '/settings/payment-credit';
const methodKinds = ['INCOME', 'EXPENSE', 'BOTH'] as const;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function formChecked(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function settingsError(code: string): never {
  const section = code === 'cash_register_rule_bank'
    ? 'routing'
    : code.startsWith('method_')
      || code.startsWith('cash_register_')
      || code === 'kind_invalid'
      || code === 'fallback_delete'
      || code === 'system_delete'
        ? 'methods'
        : 'banks';
  redirect(`${settingsPath}?section=${section}&error=${encodeURIComponent(code)}`);
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
  const current = await requireWorkspaceRole(workspaceManagementRoles, settingsPath);
  const name = validateName(formData);
  const icon = validateIcon(formData);
  const primary = formChecked(formData, 'primary');
  const existing = await prisma.bank.findFirst({ where: { workspaceId: current.workspace.id, name } });
  if (existing) settingsError('bank_exists');

  await prisma.$transaction(async tx => {
    const bank = await tx.bank.create({ data: { workspaceId: current.workspace.id, name, icon } });
    if (primary) {
      await tx.company.update({
        where: { id: current.company.id },
        data: { primaryBankId: bank.id }
      });
    }
  });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?section=banks&saved=bank_created`);
}

export async function updateBankAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, settingsPath);
  const id = Number(formValue(formData, 'id'));
  const name = validateName(formData);
  const icon = validateIcon(formData);
  const primary = formChecked(formData, 'primary');
  if (!Number.isInteger(id) || id <= 0) settingsError('invalid');

  const bank = await prisma.bank.findFirst({ where: { id, workspaceId: current.workspace.id } });
  if (!bank) settingsError('bank_not_found');
  if (primary && bank.isFallback) settingsError('cash_bank_primary');
  const duplicate = await prisma.bank.findFirst({ where: { workspaceId: current.workspace.id, name, NOT: { id } } });
  if (duplicate) settingsError('bank_exists');

  await prisma.$transaction(async tx => {
    await tx.bank.update({ where: { id }, data: { name, icon } });
    if (primary) {
      await tx.company.update({
        where: { id: current.company.id },
        data: { primaryBankId: id }
      });
    } else {
      await tx.company.updateMany({
        where: { id: current.company.id, primaryBankId: id },
        data: { primaryBankId: null }
      });
    }
  });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?section=banks&saved=bank_updated`);
}

export async function deleteBankAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, settingsPath);
  const id = Number(formValue(formData, 'id'));
  if (!Number.isInteger(id) || id <= 0) settingsError('invalid');

  const bank = await prisma.bank.findFirst({
    where: { id, workspaceId: current.workspace.id },
    include: { _count: { select: { payments: true, recurringExpenses: true, incomeLegacyCredits: true, incomeCredits: true, cashRegisterPaymentMethods: true, cashRegisterBankRules: true } } }
  });
  if (!bank) settingsError('bank_not_found');
  if (bank.isFallback) settingsError('cash_bank_delete');

  const usageCount = bank._count.payments
    + bank._count.recurringExpenses
    + bank._count.incomeLegacyCredits
    + bank._count.incomeCredits
    + bank._count.cashRegisterPaymentMethods
    + bank._count.cashRegisterBankRules;
  if (usageCount > 0) redirect(`${settingsPath}?section=banks&error=in_use&usage=${usageCount}`);

  await prisma.bank.delete({ where: { id } });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?section=banks&saved=bank_deleted`);
}

export async function createPaymentMethodAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, settingsPath);
  const name = validateName(formData);
  const kind = validateKind(formData);
  const icon = validateIcon(formData);
  const isExpenseDefault = formChecked(formData, 'isExpenseDefault') && (kind === 'EXPENSE' || kind === 'BOTH');
  const isIncomeDefault = formChecked(formData, 'isIncomeDefault') && (kind === 'INCOME' || kind === 'BOTH');
  const existing = await prisma.paymentMethod.findFirst({ where: { workspaceId: current.workspace.id, name } });
  if (existing) settingsError('method_exists');

  await prisma.$transaction(async tx => {
    if (isExpenseDefault) {
      await tx.paymentMethod.updateMany({where: {workspaceId: current.workspace.id}, data: {isExpenseDefault: false}});
    }
    if (isIncomeDefault) {
      await tx.paymentMethod.updateMany({where: {workspaceId: current.workspace.id}, data: {isIncomeDefault: false}});
    }
    await tx.paymentMethod.create({
      data: { workspaceId: current.workspace.id, name, kind, icon, isExpenseDefault, isIncomeDefault }
    });
  });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?section=methods&saved=method_created`);
}

export async function updatePaymentMethodAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, settingsPath);
  const id = Number(formValue(formData, 'id'));
  const name = validateName(formData);
  const kind = validateKind(formData);
  const icon = validateIcon(formData);
  const isExpenseDefault = formChecked(formData, 'isExpenseDefault') && (kind === 'EXPENSE' || kind === 'BOTH');
  const isIncomeDefault = formChecked(formData, 'isIncomeDefault') && (kind === 'INCOME' || kind === 'BOTH');
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

  await prisma.$transaction(async tx => {
    if (isExpenseDefault) {
      await tx.paymentMethod.updateMany({where: {workspaceId: current.workspace.id, id: {not: id}}, data: {isExpenseDefault: false}});
    }
    if (isIncomeDefault) {
      await tx.paymentMethod.updateMany({where: {workspaceId: current.workspace.id, id: {not: id}}, data: {isIncomeDefault: false}});
    }
    await tx.paymentMethod.update({
      where: { id },
      data: {
        name, kind, icon, isExpenseDefault, isIncomeDefault,
        ...(cashRegisterManaged ? {cashRegisterEnabled, cashRegisterDefaultBankId} : {})
      }
    });
    if (replacementPrimaryId !== undefined) {
      await tx.workspace.update({
        where: {id: current.workspace.id},
        data: {cashRegisterPrimaryPaymentMethodId: replacementPrimaryId}
      });
    }
  });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?section=methods&saved=method_updated`);
}

export async function deletePaymentMethodAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, settingsPath);
  const id = Number(formValue(formData, 'id'));
  if (!Number.isInteger(id) || id <= 0) settingsError('invalid');

  const method = await prisma.paymentMethod.findFirst({
    where: { id, workspaceId: current.workspace.id },
    include: { _count: { select: { incomePayments: true, incomeCredits: true, expensePayments: true, recurringExpenses: true, cashRegisterPrimaryForWorkspaces: true } } }
  });
  if (!method) settingsError('method_not_found');
  if (method.isFallback) settingsError('fallback_delete');
  if (method.systemRole) settingsError('system_delete');
  if (method.cashRegisterEnabled || method._count.cashRegisterPrimaryForWorkspaces) settingsError('cash_register_method_delete');

  const usageCount = method._count.incomePayments + method._count.incomeCredits + method._count.expensePayments + method._count.recurringExpenses;
  if (usageCount > 0) redirect(`${settingsPath}?section=methods&error=in_use&usage=${usageCount}`);

  await prisma.paymentMethod.delete({ where: { id } });
  refreshPaymentCreditPages();
  redirect(`${settingsPath}?section=methods&saved=method_deleted`);
}

export async function updateCashRegisterBankRulesAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, settingsPath);
  const [methods, channels, banks] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: {
        workspaceId: current.workspace.id,
        cashRegisterEnabled: true,
        kind: { in: ['INCOME', 'BOTH'] },
        OR: [{ systemRole: null }, { systemRole: { not: 'CASH' } }]
      },
      select: { id: true }
    }),
    prisma.incomeSalesChannel.findMany({
      where: { workspaceId: current.workspace.id },
      select: { id: true }
    }),
    prisma.bank.findMany({
      where: { workspaceId: current.workspace.id },
      select: { id: true }
    })
  ]);
  const bankIds = new Set(banks.map(bank => bank.id));
  const rules = methods.flatMap(method => channels.map(channel => {
    const bankId = Number(formValue(formData, `rule_${method.id}_${channel.id}`));
    if (!bankIds.has(bankId)) settingsError('cash_register_rule_bank');
    return { methodId: method.id, channelId: channel.id, bankId };
  }));

  await prisma.$transaction(rules.map(rule => prisma.cashRegisterBankRule.upsert({
    where: {
      workspaceId_paymentMethodId_salesChannelId: {
        workspaceId: current.workspace.id,
        paymentMethodId: rule.methodId,
        salesChannelId: rule.channelId
      }
    },
    update: { bankId: rule.bankId },
    create: {
      workspaceId: current.workspace.id,
      paymentMethodId: rule.methodId,
      salesChannelId: rule.channelId,
      bankId: rule.bankId
    }
  })));

  refreshPaymentCreditPages();
  redirect(`${settingsPath}?section=routing&saved=cash_register_rules_updated`);
}
