import {mutateTrackingInvoice} from '@/lib/product-tracking-invoice-service';
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  return mutateTrackingInvoice(request, Number((await params).id));
}
