import Link from 'next/link';
import {notFound} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireWorkspace} from '@/lib/auth';

export default async function EditSupplierPage({params, searchParams}: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const current = await requireWorkspace('/suppliers');
    const {id} = await params;
    const query = (await searchParams) ?? {};
    const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
    const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : `/suppliers/${id}`;
    const supplier = await prisma.supplier.findFirst({where: {id: Number(id), workspaceId: current.workspace.id}});
    if (!supplier) notFound();

    return <div className="modal-page-wrap">
        <div className="modal-card modal-card-wide modal-page-card supplier-form-page-card">
            <div className="modal-title">
                <div>
                    <h2>Modifica fornitore</h2>
                    <p className="muted">Aggiorna l’anagrafica di {supplier.businessName}.</p>
                </div>
                <Link className="btn btn-icon-only btn-default modal-close-button" href={returnTo}
                      aria-label="Chiudi modifica fornitore">×</Link>
            </div>
            <form className="card form income-form expense-form supplier-form supplier-styled-form"
                  action={`/api/suppliers/${supplier.id}?returnTo=${encodeURIComponent(returnTo)}`} method="post">
                <details className="form-section full income-form-section supplier-form-section" open>
                    <summary>
                        <span><span className="supplier-form-section-icon" aria-hidden="true">◉</span>Anagrafica</span>
                        <small>Dati principali del fornitore</small>
                    </summary>
                    <div className="form-section-grid income-form-section-grid supplier-form-section-grid">
                        <label className="span-2">Ragione Sociale<input name="businessName" required defaultValue={supplier.businessName}/></label>
                        <label>Alias<input name="alias" defaultValue={supplier.alias ?? ''}/></label>
                        <label>Email<input name="email" type="email" defaultValue={supplier.email ?? ''}/></label>
                        <label>P.IVA<input name="vatNumber" defaultValue={supplier.vatNumber ?? ''}/></label>
                        <label>IBAN<input name="iban" defaultValue={supplier.iban ?? ''}/></label>
                        <label>PEC<input name="pec" type="email" defaultValue={supplier.pec ?? ''}/></label>
                        <label>Codice SDI/Codice Fiscale<input name="taxCodeSdi" defaultValue={supplier.taxCodeSdi ?? ''}/></label>
                    </div>
                </details>

                <details className="form-section full income-form-section supplier-form-section" open>
                    <summary>
                        <span><span className="supplier-form-section-icon" aria-hidden="true">≡</span>Note</span>
                        <small>Annotazioni interne e informazioni operative</small>
                    </summary>
                    <div className="form-section-stack income-form-section-stack">
                        <label>Note interne<textarea name="internalNotes" rows={4} defaultValue={supplier.internalNotes ?? ''}/></label>
                    </div>
                </details>

                <div className="full actions-row right-actions form-actions-row supplier-form-actions">
                    <Link className="btn btn-md btn-default" href={returnTo}><span className="btn-icon">✕</span> Annulla</Link>
                    <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">✓</span> Salva modifiche</button>
                </div>
            </form>
        </div>
    </div>;
}
