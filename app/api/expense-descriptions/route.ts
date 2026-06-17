import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext } from '@/lib/auth';

export async function GET(request: Request) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();
  const rows = await prisma.expense.findMany({
    where: search ? { workspaceId: current.workspace.id, description: { contains: search, mode: 'insensitive' } } : { workspaceId: current.workspace.id, description: { not: null } },
    select: { description: true },
    orderBy: { updatedAt: 'desc' },
    take: 120
  });
  const seen = new Set<string>();
  const suggestions = rows
    .map(row => String(row.description || '').trim())
    .filter(Boolean)
    .filter(value => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
  return NextResponse.json(suggestions);
}
