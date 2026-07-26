import { NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readExpenseAttachment } from '@/lib/attachments';

function contentDisposition(name: string) {
  const fallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getWorkspaceContext();
  if (!current) return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 });

  const attachmentId = Number((await params).id);
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    return NextResponse.json({ error: 'Allegato non valido' }, { status: 400 });
  }

  const attachment = await prisma.expenseAttachment.findFirst({
    where: {
      id: attachmentId,
      expense: { workspaceId: current.workspace.id }
    }
  });
  if (!attachment) return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 });

  try {
    const file = await readExpenseAttachment(attachment.path);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Length': String(file.byteLength),
        'Content-Disposition': contentDisposition(attachment.originalName),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch {
    return NextResponse.json({ error: 'File allegato non disponibile' }, { status: 404 });
  }
}

