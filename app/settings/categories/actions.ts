'use server';

import { redirect } from 'next/navigation';
import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { categoryIconOptions, defaultExpenseCategoryCode } from '@/lib/workspace-defaults';
import { writeAuditLog } from '@/lib/audit';

const categoriesPath = '/settings/categories/expenses';

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function categoriesError(code: string): never {
  redirect(`${categoriesPath}?error=${encodeURIComponent(code)}`);
}

function validateCategoryInput(formData: FormData) {
  const name = formValue(formData, 'name');
  const code = normalizeCode(formValue(formData, 'code'));
  const icon = formValue(formData, 'icon') || null;

  if (!name || !code) categoriesError('invalid');
  if (code.length > 5) categoriesError('code_length');
  if (!/^[A-Z0-9]+$/.test(code)) categoriesError('code_format');
  if (icon && !categoryIconOptions.includes(icon as typeof categoryIconOptions[number])) categoriesError('icon_invalid');

  return { name, code, icon };
}

export async function createCategoryAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, categoriesPath);
  const { name, code, icon } = validateCategoryInput(formData);

  const existing = await prisma.expenseCategory.findFirst({
    where: { workspaceId: current.workspace.id, code }
  });
  if (existing) categoriesError('code_exists');

  const category = await prisma.expenseCategory.create({
    data: {
      workspaceId: current.workspace.id,
      name,
      code,
      icon
    }
  });
  await writeAuditLog({ workspaceId: current.workspace.id, userId: current.user.id, action: 'CREATE', entityType: 'ExpenseCategory', entityId: category.id });

  redirect(`${categoriesPath}?saved=created`);
}

export async function updateCategoryAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, categoriesPath);
  const id = Number(formValue(formData, 'id'));
  const { name, code, icon } = validateCategoryInput(formData);

  if (!Number.isInteger(id) || id <= 0) categoriesError('invalid');

  const category = await prisma.expenseCategory.findFirst({
    where: { id, workspaceId: current.workspace.id }
  });
  if (!category) categoriesError('not_found');
  if (category.code === defaultExpenseCategoryCode && code !== defaultExpenseCategoryCode) {
    categoriesError('default_category_protected');
  }

  const duplicate = await prisma.expenseCategory.findFirst({
    where: {
      workspaceId: current.workspace.id,
      code,
      NOT: { id }
    }
  });
  if (duplicate) categoriesError('code_exists');

  await prisma.expenseCategory.update({
    where: { id },
    data: { name, code, icon }
  });
  await writeAuditLog({ workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE', entityType: 'ExpenseCategory', entityId: id });

  redirect(`${categoriesPath}?saved=updated`);
}

export async function deleteCategoryAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, categoriesPath);
  const id = Number(formValue(formData, 'id'));

  if (!Number.isInteger(id) || id <= 0) categoriesError('invalid');

  const category = await prisma.expenseCategory.findFirst({
    where: { id, workspaceId: current.workspace.id },
    include: { _count: { select: { expenses: true, recurringExpenses: true } } }
  });
  if (!category) categoriesError('not_found');
  if (category.code === defaultExpenseCategoryCode) categoriesError('default_category_protected');

  const configuredWorkspace = await prisma.workspace.findFirst({
    where: { id: current.workspace.id, vatSettlementCategoryId: id },
    select: { id: true }
  });
  if (configuredWorkspace) categoriesError('vat_settlement_category');

  const usageCount = category._count.expenses + category._count.recurringExpenses;
  if (usageCount > 0) redirect(`${categoriesPath}?error=in_use&usage=${usageCount}`);

  await prisma.expenseCategory.delete({ where: { id } });
  await writeAuditLog({ workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE', entityType: 'ExpenseCategory', entityId: id });

  redirect(`${categoriesPath}?saved=deleted`);
}

export async function setVatSettlementCategoryAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, categoriesPath);
  const categoryId = Number(formValue(formData, 'categoryId'));
  if (!Number.isInteger(categoryId) || categoryId <= 0) categoriesError('invalid');
  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, workspaceId: current.workspace.id } });
  if (!category) categoriesError('not_found');
  await prisma.workspace.update({ where: { id: current.workspace.id }, data: { vatSettlementCategoryId: category.id } });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE',
    entityType: 'WorkspaceSettings', entityId: current.workspace.id,
    metadata: { vatSettlementCategoryId: category.id }
  });
  redirect(`${categoriesPath}?saved=vat_settlement_category`);
}
