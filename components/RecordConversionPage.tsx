import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import {loadRecordConversionForm, ConversionFormDataError} from '@/lib/record-conversion-form-data';
import RecordConversionForm from '@/components/RecordConversionForm';

export default async function RecordConversionPage({kind, id, returnHref: requestedReturnHref}: {kind: 'expenses' | 'incomes'; id: number; returnHref?: string}) {
    const current = await requireWorkspaceRole(workspaceOperationalRoles, `/${kind}/${id}/convert`);
    if (!Number.isSafeInteger(id) || id <= 0) notFound();
    try {
        const props = await loadRecordConversionForm(kind, id, current);
        return <RecordConversionForm {...props} returnHref={requestedReturnHref ?? props.returnHref}/>;
    } catch (error) {
        if (error instanceof ConversionFormDataError && error.status === 400) return <Unavailable href={requestedReturnHref ?? `/${kind}/${id}`}/>;
        if (error instanceof ConversionFormDataError && error.status === 404) notFound();
        throw error;
    }
}

function Unavailable({href}: {href: string}) {
    return <div className="card"><h2>Conversione non disponibile</h2><p>Le ricorrenze e le spese di tipo Saldo IVA non sono convertibili.</p><Link className="btn btn-md btn-default" href={href}>Torna al dettaglio</Link></div>;
}
