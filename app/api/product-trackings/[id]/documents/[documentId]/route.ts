import {mutateTrackingDocument} from '@/lib/product-tracking-attachment-service';
export async function POST(request: Request, {params}: {params: Promise<{id: string; documentId: string}>}) {
  const {id, documentId} = await params;
  return mutateTrackingDocument(request, Number(id), Number(documentId));
}
export async function DELETE(request: Request, {params}: {params: Promise<{id: string; documentId: string}>}) {
  const {id, documentId} = await params;
  return mutateTrackingDocument(request, Number(id), Number(documentId), true);
}
