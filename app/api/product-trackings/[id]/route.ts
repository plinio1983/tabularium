import {saveTracking, deleteTracking} from '@/lib/product-tracking-save';
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {return saveTracking(request, Number((await params).id));}
export async function DELETE(request: Request, {params}: {params: Promise<{id: string}>}) {return deleteTracking(request, Number((await params).id));}
