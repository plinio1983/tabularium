import {handleRecordConversion} from '@/lib/record-conversion-service';

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
    const {id} = await params;
    return handleRecordConversion('incomes', request, Number(id));
}
