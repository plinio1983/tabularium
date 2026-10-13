import {mutateTrackingDocument} from '@/lib/product-tracking-attachment-service';
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  return mutateTrackingDocument(request, Number((await params).id));
}
