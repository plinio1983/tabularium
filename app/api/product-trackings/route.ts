import {saveTracking} from '@/lib/product-tracking-save';
export async function POST(request: Request) {return saveTracking(request);}
