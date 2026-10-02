import {NextResponse} from 'next/server';
import {getWorkspaceApiAccess, workspaceOperationalRoles} from '@/lib/auth';
import {loadRecordConversionForm, ConversionFormDataError} from '@/lib/record-conversion-form-data';
import {handleRecordConversion} from '@/lib/record-conversion-service';

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
    const {id} = await params;
    return handleRecordConversion('expenses', request, Number(id));
}

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
    const access = await getWorkspaceApiAccess(workspaceOperationalRoles);
    if (!access.ok) return NextResponse.json({error: access.error}, {status: access.status});
    try {
        const {id} = await params;
        return NextResponse.json(await loadRecordConversionForm('expenses', Number(id), access.current), {headers: {'Cache-Control': 'no-store'}});
    } catch (error) {
        if (error instanceof ConversionFormDataError) return NextResponse.json({error: error.message}, {status: error.status});
        console.error('Conversion form loading failed', error);
        return NextResponse.json({error: 'Impossibile caricare il form di conversione.'}, {status: 500});
    }
}
