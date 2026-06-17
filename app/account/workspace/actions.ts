'use server';

import { redirect } from 'next/navigation';
import { requireWorkspace, type WorkspaceRoleName } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

export async function updateWorkspaceNameAction(formData: FormData) {
  const current = await requireWorkspace('/account/workspace');
  const role = current.membership.role as WorkspaceRoleName;
  if (role !== 'OWNER' && role !== 'ADMIN') redirect('/account/workspace?error=forbidden');

  const name = value(formData, 'name');
  if (!name) redirect('/account/workspace?error=invalid');

  await prisma.workspace.update({
    where: { id: current.workspace.id },
    data: { name }
  });

  redirect('/account/workspace?saved=1');
}
