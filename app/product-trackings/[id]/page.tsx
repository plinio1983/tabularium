import Link from 'next/link';
import {notFound} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireWorkspace, hasWorkspaceRole, workspaceOperationalRoles} from '@/lib/auth';
import {calendarDateInput} from '@/lib/company-time';
import {formatItalianCompactDate} from '@/lib/date-format';
import {detailBackHref} from '@/lib/detail-navigation';
import {sixMonthsAgo} from '@/lib/product-tracking';
import DetailBackButton from '@/components/DetailBackButton';
import DetailActionsBar from '@/components/DetailActionsBar';
import CopyValueButton from '@/components/CopyValueButton';
import ProductTrackingEditor from '@/components/ProductTrackingEditor';
import ProductTrackingDelete from '@/components/ProductTrackingDelete';
import ProductTrackingDocuments from '@/components/ProductTrackingDocuments';
import ProductTrackingInvoices from '@/components/ProductTrackingInvoices';
import ProductTrackingStatus from '@/components/ProductTrackingStatus';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';

export default async function Page({params, searchParams}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspace('/product-trackings');
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    const record = await prisma.productTracking.findFirst({
        where: {
            id,
            workspaceId: current.workspace.id,
            companyId: current.company.id
        }, include: {attachments: {orderBy: {createdAt: 'asc'}}}
    });
    if (!record) notFound();
    const query = await searchParams;
    const rawReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
    const candidate = detailBackHref(rawReturnTo, `/product-trackings/${id}`, '/product-trackings');
    const returnTo = candidate.split('?')[0] === '/product-trackings' ? candidate : '/product-trackings';
    const detailHref = `/product-trackings/${id}?returnTo=${encodeURIComponent(returnTo)}`;
    const canEdit = hasWorkspaceRole(current.membership.role, workspaceOperationalRoles);
    const editor = {
        ...record,
        entryDate: calendarDateInput(record.entryDate),
        attachments: record.attachments.map(a => ({...a, invoiceDate: calendarDateInput(a.invoiceDate)}))
    };
    return <div className="grid record-detail-page party-detail-page">
        <ActionFeedbackBanner searchParams={query} savedMessages={{updated: 'Tracciatura aggiornata.'}}
                              errorMessages={{}}/>
        <div className="record-detail-shell">
            <div className="record-detail-action-row record-detail-responsive-actions">
                <div className="left-side"><DetailBackButton href={returnTo}/></div>
                {canEdit && <div className="right-side"><DetailActionsBar primary={<>
                    <ProductTrackingEditor record={editor} returnTo={detailHref} className="btn btn-sm btn-option"/>
                    <ProductTrackingDelete id={id} returnTo={returnTo}
                                           className="btn btn-sm btn-option detail-actions-delete"/>
                </>}/></div>}
            </div>
            <article className="record-detail-document party-detail-document record-tracking">
                <section className="record-detail-hero">
                    <div className="record-detail-title-block">
                        <p className="record-detail-kicker">Tracciatura #{record.id}</p>
                        <div className="record-detail-title-main">
                            <h1>{record.name}</h1>
                            <div className="record-detail-meta-line">
                                <span>Lotto: {record.batch}</span>
                                {record.alias && <span>{record.alias}</span>}
                            </div>
                        </div>
                        <ProductTrackingStatus record={record} cutoff={sixMonthsAgo(current.company.timeZone)}/>
                    </div>
                </section>
                <section className="record-detail-section">
                    <div className="record-detail-section-heading">
                        <div>
                            <h2>Dati merce</h2><p>Identificazione del prodotto e data ingresso.</p>
                        </div>
                    </div>
                    <div className="record-detail-status-strip party-detail-info-strip">
                        <div className="copyable-detail-field">
                            <span>Nome</span><strong>{record.name}</strong><CopyValueButton value={record.name}/></div>
                        <div className="copyable-detail-field">
                            <span>Lotto</span><strong>{record.batch}</strong><CopyValueButton value={record.batch}/>
                        </div>
                        <div className="copyable-detail-field">
                            <span>Alias</span><strong>{record.alias || '—'}</strong><CopyValueButton
                            value={record.alias ?? ''}/></div>
                        <div>
                            <span>Data ingresso</span><strong>{record.entryDate ? formatItalianCompactDate(calendarDateInput(record.entryDate)) : '—'}</strong>
                        </div>
                    </div>
                </section>
                <ProductTrackingDocuments trackingId={id} readOnly={!canEdit}
                  addDocumentTrigger={<ProductTrackingEditor record={editor} returnTo={detailHref} initialMobileStep={2} openNewDocument className="btn btn-sm btn-default"/>}
                  initialDocuments={record.attachments.filter(a => a.kind === 'TRACKING').map(a => ({id: a.id, originalName: a.originalName, sizeBytes: a.sizeBytes}))}/>
                <ProductTrackingInvoices trackingId={id}
                                         addInvoiceTrigger={<ProductTrackingEditor record={editor} returnTo={detailHref}
                                                                                   initialMobileStep={3} openNewInvoice
                                                                                   className="btn btn-sm btn-default"/>}
                                         readOnly={!canEdit}
                                         initialInvoices={record.attachments.filter(a => a.kind === 'INVOICE').map(a => ({
                                             id: a.id,
                                             originalName: a.originalName,
                                             invoiceDate: calendarDateInput(a.invoiceDate),
                                             sizeBytes: a.sizeBytes
                                         }))}/>
            </article>
        </div>
    </div>;
}
