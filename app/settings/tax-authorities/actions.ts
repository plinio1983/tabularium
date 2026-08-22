'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireWorkspaceRole, workspaceManagementRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

const target = '/settings/tax-authorities';
const clean = (value: FormDataEntryValue | null) => String(value ?? '').trim();

export async function saveTaxAuthorityAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, target);
  const id = Number(formData.get('id'));
  const name = clean(formData.get('name'));
  const kind = clean(formData.get('kind')) || 'OTHER';
  const categoryId = Number(formData.get('defaultExpenseCategoryId')) || null;
  if (!name) redirect(`${target}?error=invalid`);
  if (categoryId && !await prisma.expenseCategory.findFirst({where: {id: categoryId, workspaceId: current.workspace.id}})) redirect(`${target}?error=category`);
  const data = {
    name, kind, defaultExpenseCategoryId: categoryId,
    defaultDescription: clean(formData.get('defaultDescription')) || null,
    iban: clean(formData.get('iban')) || null,
    notes: clean(formData.get('notes')) || null,
    isActive: formData.get('isActive') === 'on'
  };
  try {
    if (id) {
      const existing = await prisma.taxAuthority.findFirst({where: {id, workspaceId: current.workspace.id}});
      if (!existing) redirect(`${target}?error=not_found`);
      await prisma.taxAuthority.update({where: {id}, data});
    } else await prisma.taxAuthority.create({data: {...data, workspaceId: current.workspace.id, isActive: true}});
  } catch {
    redirect(`${target}?error=duplicate`);
  }
  revalidatePath(target);
  redirect(`${target}?saved=${id ? 'updated' : 'created'}`);
}

export async function toggleTaxAuthorityAction(formData: FormData) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, target);
  const id = Number(formData.get('id'));
  const record = await prisma.taxAuthority.findFirst({where: {id, workspaceId: current.workspace.id}});
  if (!record) redirect(`${target}?error=not_found`);
  await prisma.taxAuthority.update({where: {id}, data: {isActive: !record.isActive}});
  revalidatePath(target);
  redirect(`${target}?saved=${record.isActive ? 'archived' : 'restored'}`);
}
