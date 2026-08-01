'use server';

import { redirect } from 'next/navigation';
import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { incomeEntityIconOptions } from '@/lib/workspace-defaults';
import { writeAuditLog } from '@/lib/audit';
import {resolveDefaultIncomeCategory} from '@/lib/income-category';

const path = '/settings/categories/incomes';
type Kind = 'channel';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function fail(error: string, kind?: string, usage?: number): never {
  const query = new URLSearchParams({ error });
  if (kind) query.set('kind', kind);
  if (usage !== undefined) query.set('usage', String(usage));
  redirect(`${path}?${query}`);
}

function parse(formData: FormData) {
  const kind = value(formData, 'kind') as Kind;
  const name = value(formData, 'name');
  const icon = value(formData, 'icon') || null;
  if (kind !== 'channel' || !name) fail('invalid', kind);
  if (icon && !incomeEntityIconOptions.includes(icon as typeof incomeEntityIconOptions[number])) fail('icon_invalid', kind);
  return { kind, name, icon };
}

function codeFromName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'CANALE';
}

async function availableCode(workspaceId: number, name: string) {
  const base = codeFromName(name);
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const tail = suffix === 1 ? '' : `_${suffix}`;
    const code = `${base.slice(0, 40 - tail.length)}${tail}`;
    const existing = await prisma.incomeSalesChannel.findFirst({where: {workspaceId, code}, select: {id: true}});
    if (!existing) return code;
  }
  fail('invalid', 'channel');
}

export async function createIncomeEntityAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, path);
  const input = parse(formData);
  const code = await availableCode(current.workspace.id, input.name);
  const lastChannel = await prisma.incomeSalesChannel.findFirst({
      where: { workspaceId: current.workspace.id },
      orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }],
      select: { sortOrder: true }
    });
  const entity = await prisma.incomeSalesChannel.create({
      data: {
        workspaceId: current.workspace.id,
        name: input.name,
        code,
        icon: input.icon,
        sortOrder: (lastChannel?.sortOrder ?? 0) + 10
      }
    });
  await writeAuditLog({ workspaceId: current.workspace.id, userId: current.user.id, action: 'CREATE', entityType: 'IncomeSalesChannel', entityId: entity.id });
  redirect(`${path}?saved=created&kind=${input.kind}`);
}

export async function updateIncomeEntityAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, path);
  const id = Number(value(formData, 'id'));
  const input = parse(formData);
  if (!Number.isInteger(id) || id <= 0) fail('invalid', input.kind);
  const entity = await prisma.incomeSalesChannel.findFirst({ where: { id, workspaceId: current.workspace.id } });
    if (!entity) fail('not_found', input.kind);
    const sortOrder = Number(value(formData, 'sortOrder'));
    const isDefault = checked(formData, 'isDefault') && !entity.isFallback;
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) fail('invalid', input.kind);
    await prisma.$transaction(async tx => {
      if (isDefault) {
        await tx.incomeSalesChannel.updateMany({
          where: {workspaceId: current.workspace.id, id: {not: id}},
          data: {isDefault: false}
        });
      }
      await tx.incomeSalesChannel.update({
        where: { id },
        data: { name: input.name, icon: input.icon, sortOrder, isDefault }
      });
    });
  await writeAuditLog({ workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE', entityType: 'IncomeSalesChannel', entityId: id });
  redirect(`${path}?saved=updated&kind=${input.kind}`);
}

export async function deleteIncomeEntityAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, path);
  const id = Number(value(formData, 'id'));
  const kind = value(formData, 'kind') as Kind;
  if (!Number.isInteger(id) || id <= 0 || kind !== 'channel') fail('invalid', kind);
  const entity = await prisma.incomeSalesChannel.findFirst({ where: { id, workspaceId: current.workspace.id }, include: { _count: { select: { incomes: true } } } });
    if (!entity) fail('not_found', kind);
    if (entity.isFallback) fail('fallback_delete', kind);
    const configured = await prisma.workspace.count({where: {id: current.workspace.id, cashRegisterSalesChannelId: id}});
    if (configured) fail('cash_register_in_use', kind);
    if (entity._count.incomes) fail('in_use', kind, entity._count.incomes);
    await prisma.incomeSalesChannel.delete({ where: { id } });
  await writeAuditLog({ workspaceId: current.workspace.id, userId: current.user.id, action: 'DELETE', entityType: 'IncomeSalesChannel', entityId: id });
  redirect(`${path}?saved=deleted&kind=${kind}`);
}

export async function updateCashRegisterIncomeDefaultsAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, path);
  const salesChannelId = Number(value(formData, 'cashRegisterSalesChannelId'));
  if (!Number.isInteger(salesChannelId)) fail('invalid');
  const [category, channel] = await Promise.all([
    resolveDefaultIncomeCategory(current.workspace.id),
    prisma.incomeSalesChannel.findFirst({ where: { id: salesChannelId, workspaceId: current.workspace.id } })
  ]);
  if (!category || !channel) fail('not_found');
  await prisma.workspace.update({
    where: { id: current.workspace.id },
    data: { cashRegisterIncomeCategoryId: category.id, cashRegisterSalesChannelId: channel.id }
  });
  await writeAuditLog({
    workspaceId: current.workspace.id, userId: current.user.id, action: 'UPDATE',
    entityType: 'WorkspaceSettings', entityId: current.workspace.id,
    metadata: { cashRegisterIncomeCategoryId: category.id, cashRegisterSalesChannelId: channel.id }
  });
  redirect(`${path}?saved=cash_register`);
}
