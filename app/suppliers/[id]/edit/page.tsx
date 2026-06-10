import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id: Number(id) } });
  if (!supplier) notFound();

  return <div className="grid">
    <div className="toolbar-card">
      <div>
        <h2>Modifica fornitore</h2>
        <p className="muted">{supplier.businessName}</p>
      </div>
      <Link className="table-action secondary" href="/suppliers">✕ Annulla</Link>
    </div>
    <form className="card form income-form expense-form supplier-form supplier-styled-form" action={`/api/suppliers/${supplier.id}`} method="post">
      <details className="form-section full income-form-section supplier-form-section" open>
        <summary>
          <span>Anagrafica</span>
          <small>Dati principali del fornitore</small>
        </summary>
        <div className="form-section-grid income-form-section-grid supplier-form-section-grid">
          <label className="span-2">Ragione Sociale<input name="businessName" required defaultValue={supplier.businessName} /></label>
          <label>Alias<input name="alias" defaultValue={supplier.alias ?? ''} /></label>
          <label>Email<input name="email" type="email" defaultValue={supplier.email ?? ''} /></label>
          <label>Telefono<input name="phone" defaultValue={supplier.phone ?? ''} /></label>
          <label>PEC<input name="pec" type="email" defaultValue={supplier.pec ?? ''} /></label>
          <label>Codice SDI/Codice Fiscale<input name="taxCodeSdi" defaultValue={supplier.taxCodeSdi ?? ''} /></label>
        </div>
      </details>

      <details className="form-section full income-form-section supplier-form-section" open>
        <summary>
          <span>Note</span>
          <small>Annotazioni interne e informazioni operative</small>
        </summary>
        <div className="form-section-stack income-form-section-stack">
          <label>Note interne<textarea name="internalNotes" rows={4} defaultValue={supplier.internalNotes ?? ''} /></label>
        </div>
      </details>

      <div className="full actions-row right-actions form-actions-row supplier-form-actions">
        <Link className="secondary-button button-standard" href="/suppliers">✕ Annulla</Link>
        <button className="button-standard primary-action" type="submit">✓ Salva modifiche</button>
      </div>
    </form>
  </div>;
}
