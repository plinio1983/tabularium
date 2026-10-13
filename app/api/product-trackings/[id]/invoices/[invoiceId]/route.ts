import {mutateTrackingInvoice} from '@/lib/product-tracking-invoice-service';
export async function POST(request: Request, {params}: {params: Promise<{id: string; invoiceId: string}>}) {
  const {id, invoiceId} = await params;
  return mutateTrackingInvoice(request, Number(id), Number(invoiceId));
}
export async function DELETE(request: Request, {params}: {params: Promise<{id: string; invoiceId: string}>}) {
  const {id, invoiceId} = await params;
  return mutateTrackingInvoice(request, Number(id), Number(invoiceId), true);
}
