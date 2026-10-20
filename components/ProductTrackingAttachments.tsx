'use client';

import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {createPortal} from 'react-dom';
import {DateField, FormField} from '@/components/FormControls';
import InfoHint from '@/components/InfoHint';
import {calendarDateInput, dateInputInTimeZone} from '@/lib/company-time';
import {formatItalianCompactDate} from '@/lib/date-format';
import {
    invoiceRow,
    invoiceDraftError,
    type TrackingInvoice,
    type TrackingInvoiceRow,
    type TrackingInvoiceFormState
} from '@/lib/product-tracking-invoice';
import {documentDraftError, type TrackingDocument} from '@/lib/product-tracking-document';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {latestTrackingDocumentDate, trackingDocumentAge, trackingDocumentAgeClass} from '@/lib/tracking-document-age';

export default function ProductTrackingAttachments({
                                                       initialAttachments,
                                                       kind = 'INVOICE',
                                                       trackingId,
                                                       readOnly = false,
                                                       disabled = false,
                                                       onStateChange,
                                                       initiallyAddAttachment = false,
                                                       addAttachmentTrigger,
                                                   }: {
    initialAttachments: Array<TrackingInvoice | TrackingDocument>;
    kind?: 'INVOICE' | 'TRACKING';
    trackingId?: number;
    readOnly?: boolean;
    disabled?: boolean;
    onStateChange?: (state: TrackingInvoiceFormState) => void;
    initiallyAddAttachment?: boolean;
    addAttachmentTrigger?: ReactNode;
}) {
    const router = useRouter();
    const timeZone = useCompanyTimeZone();
    const today = dateInputInTimeZone(timeZone);
    const isInvoice = kind === 'INVOICE';
    const title = isInvoice ? 'Fatture' : 'Documenti di tracciamento';
    const addLabel = isInvoice ? 'Aggiungi fattura' : 'Aggiungi documento';
    const endpoint = isInvoice ? 'invoices' : 'documents';
    const fieldId = useId();
    const [rows, setRows] = useState<TrackingInvoiceRow[]>(() => initialAttachments.map(item => invoiceRow({
        ...item,
        invoiceDate: 'invoiceDate' in item ? item.invoiceDate : ''
    })));
    const [draft, setDraft] = useState<TrackingInvoiceRow | null>(() => initiallyAddAttachment && !readOnly && initialAttachments.length < 5 ? {
        key: 'new-0',
        originalName: '',
        invoiceDate: ''
    } : null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const nextKey = useRef(initiallyAddAttachment ? 1 : 0);
    const busyRef = useRef(false);
    const draftRef = useRef<HTMLDivElement>(null);
    const locked = disabled || busy;

    useEffect(() => {
        if (trackingId) setRows(initialAttachments.map(item => invoiceRow({
            ...item,
            invoiceDate: 'invoiceDate' in item ? item.invoiceDate : ''
        })));
    }, [initialAttachments, trackingId]);
    useEffect(() => {
        onStateChange?.({
            rows,
            hasDraft: draft !== null,
            removedIds: initialAttachments.filter(a => !rows.some(row => row.id === a.id)).map(a => a.id)
        });
    }, [rows, draft, initialAttachments, onStateChange]);
    useEffect(() => {
        if (!draft) return;
        const previousFocus = trackingId ? document.activeElement as HTMLElement | null : null;
        draftRef.current?.scrollIntoView({behavior: 'smooth', block: 'center'});
        draftRef.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll: true});
        return () => {if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});};
    }, [draft?.key, trackingId]);

    function edit(row: TrackingInvoiceRow) {
        if (locked || draft) return;
        setError('');
        setFeedback('');
        setDraft({...row});
    }

    async function confirmDraft() {
        if (!draft || locked || busyRef.current) return;
        const validation = isInvoice ? invoiceDraftError(draft) : documentDraftError(draft);
        if (validation) {
            setError(validation);
            return;
        }
        if (!trackingId) {
            setRows(current => current.some(row => row.key === draft.key) ? current.map(row => row.key === draft.key ? draft : row) : [...current, draft]);
            setDraft(null);
            setError('');
            return;
        }
        busyRef.current = true;
        setBusy(true);
        setError('');
        try {
            const data = new FormData();
            data.set(isInvoice ? 'invoiceDate' : 'documentDate', isInvoice ? draft.invoiceDate : draft.documentDate ?? '');
            if (draft.file) data.append('document', draft.file);
            const response = await fetch(`/api/product-trackings/${trackingId}/${endpoint}${draft.id ? `/${draft.id}` : ''}`, {
                method: 'POST',
                body: data
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || `Impossibile salvare ${isInvoice ? 'la fattura' : 'il documento'}.`);
            const confirmed = invoiceRow({
                ...payload,
                invoiceDate: isInvoice ? calendarDateInput(payload.invoiceDate) : '',
                documentDate: calendarDateInput(payload.documentDate)
            });
            setRows(current => draft.id ? current.map(row => row.id === draft.id ? confirmed : row) : [...current, confirmed]);
            setDraft(null);
            setFeedback(isInvoice ? draft.id ? 'Fattura aggiornata.' : 'Fattura aggiunta.' : draft.id ? 'Documento aggiornato.' : 'Documento aggiunto.');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Impossibile salvare ${isInvoice ? 'la fattura' : 'il documento'}.`);
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    async function remove(row: TrackingInvoiceRow) {
        if (locked || draft || busyRef.current) return;
        if (row.id && !window.confirm(isInvoice ? 'Eliminare questa fattura e il documento allegato?' : 'Eliminare questo documento di tracciamento?')) return;
        setError('');
        setFeedback('');
        if (!trackingId) {
            setRows(current => current.filter(item => item.key !== row.key));
            return;
        }
        busyRef.current = true;
        setBusy(true);
        try {
            const response = await fetch(`/api/product-trackings/${trackingId}/${endpoint}/${row.id}`, {method: 'DELETE'});
            if (!response.ok) {
                const payload = await response.json();
                throw new Error(payload.error || `Impossibile eliminare ${isInvoice ? 'la fattura' : 'il documento'}.`);
            }
            setRows(current => current.filter(item => item.id !== row.id));
            setFeedback(isInvoice ? 'Fattura eliminata.' : 'Documento eliminato.');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Impossibile eliminare ${isInvoice ? 'la fattura' : 'il documento'}.`);
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    const addButton = !readOnly && (addAttachmentTrigger
        // Server-provided children can be deferred Flight references, not elements
        // that cloneElement can inspect. Render them unchanged inside a native group.
        ? <fieldset className="product-tracking-add-trigger" disabled={locked || draft !== null}
                    aria-label={trackingId ? (isInvoice ? 'Gestisci fatture' : 'Gestisci documenti') : addLabel}>{addAttachmentTrigger}</fieldset>
        :
        <button type="button" className="btn btn-sm btn-default" disabled={locked || draft !== null || rows.length >= 5}
                onClick={() => {
                    setError('');
                    setFeedback('');
                    setDraft({key: `new-${nextKey.current++}`, originalName: '', invoiceDate: ''});
                }}><span className="btn-icon btn-icon-add" aria-hidden="true">＋</span> {addLabel}</button>);

    const rowDate = (row: TrackingInvoiceRow) => isInvoice ? row.invoiceDate : row.documentDate;
    const latestDate = latestTrackingDocumentDate(rows.map(rowDate));
    const latestAge = trackingDocumentAge(latestDate, today);

    function summary(row: TrackingInvoiceRow) {
        const age = trackingDocumentAge(rowDate(row), today);
        return <article
            className={`payment-row payment-summary-row product-tracking-invoice-summary${isInvoice ? '' : ' product-tracking-document-summary'}`}
            key={row.key}>
            <div className="payment-summary-primary">
                <span
                    className="payment-summary-kicker">{isInvoice ? 'Documento fattura' : 'Documento di tracciamento'}</span>
                {row.id && !row.file ? <a href={`/api/product-tracking-attachments/${row.id}?download=1`}
                                          download={row.originalName}
                                          className={trackingId ? 'product-tracking-attachment-download' : undefined}
                                          aria-label={`Scarica ${row.originalName}`}><strong>{row.originalName}</strong></a> :
                    <strong>{row.file?.name ?? row.originalName}</strong>}
            </div>
            {/*<div className="payment-summary-secondary">*/}
            {<div className="payment-summary-date">
                <span>{isInvoice ? 'Data fattura' : 'Data documento'}</span><strong>{!isInvoice && !row.documentDate ? 'Data documento mancante' : formatItalianCompactDate(isInvoice ? row.invoiceDate : row.documentDate!)}</strong>{age.date &&
                <small className={trackingDocumentAgeClass(age)}>{age.label}</small>}</div>}
            <div className="payment-summary-meta">
                <div>
                    <span>Dimensione</span><strong>{row.sizeBytes ? `${Math.max(1, Math.round(row.sizeBytes / 1024))} KB` : '—'}</strong>
                </div>
            </div>
            {/*</div>*/}
            {!readOnly && !trackingId && <div className="payment-row-actions">
                <button type="button" className="btn btn-sm btn-default" disabled={locked || draft !== null}
                        onClick={() => edit(row)}><span className="btn-icon">✎</span> Modifica
                </button>
                <button type="button" className="btn btn-sm btn-danger remove-row" disabled={locked || draft !== null}
                        onClick={() => remove(row)}><span className="btn-icon">🗑</span> Elimina
                </button>
            </div>}
        </article>;
    }

    const draftEditor = draft && <div ref={draftRef} className="payment-row product-tracking-invoice-editor">
            <fieldset disabled={locked} className="product-tracking-fields">
                <FormField
                    label={draft.id ? 'Sostituisci documento (facoltativo)' : isInvoice ? 'Documento fattura *' : 'Documento di tracciamento *'}
                    icon="📎" htmlFor={`${fieldId}-document`}>
                    <input id={`${fieldId}-document`} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xml,.p7m"
                           onChange={event => {
                               const file = event.currentTarget.files?.[0];
                               if (file) {
                                   setDraft(current => current ? {
                                       ...current,
                                       file,
                                       originalName: file.name,
                                       sizeBytes: file.size
                                   } : null);
                                   setError('');
                               }
                               event.currentTarget.value = '';
                           }}/>
                    <small
                        className="muted">{draft.file?.name ?? (draft.id ? draft.originalName : 'Seleziona un documento')} ·
                        PDF, immagini, XML, P7M · max 10 MB</small>
                </FormField>
                <DateField label={isInvoice ? "Data fattura *" : "Data documento *"}
                           name={isInvoice ? "invoiceDraftDate" : "documentDraftDate"} required
                           value={isInvoice ? draft.invoiceDate : draft.documentDate ?? ''}
                           onChange={value => setDraft(current => current ? {
                               ...current,
                               [isInvoice ? 'invoiceDate' : 'documentDate']: value
                           } : null)}/>
            </fieldset>
            <div className="payment-edit-actions">
                <button type="button" className="btn btn-sm btn-default" disabled={locked} onClick={() => {
                    setDraft(null);
                    setError('');
                }}><span className="btn-icon">×</span> Annulla
                </button>
                <button type="button" className="btn btn-sm btn-primary payment-collapse-action" disabled={locked}
                        onClick={confirmDraft}><span className="btn-icon">✓</span> {busy ? 'Salvataggio…' : 'Conferma'}
                </button>
            </div>
        </div>;

    const content = <div className="form-section-stack product-tracking-invoice-list">
        {!trackingId && <div className="form-summary"><span
            className="muted">{isInvoice ? 'Massimo 5 fatture' : 'Massimo 5 documenti'} · 10 MB per documento</span>{addButton}
        </div>}
        {rows.filter(row => trackingId || row.key !== draft?.key).map(summary)}
        {!trackingId && draftEditor}
        {!rows.length && !draft && <div
            className="record-empty-state">{isInvoice ? 'Nessuna fattura aggiunta.' : 'Nessun documento di tracciamento aggiunto.'}</div>}
        {draft && !trackingId &&
            <p className="muted">Conferma o annulla {isInvoice ? 'la fattura aperta' : 'il documento aperto'} prima di
                salvare la tracciatura.</p>}
        {rows.length >= 5 && !draft && !readOnly &&
            <p className="muted">{isInvoice ? 'Limite di 5 fatture raggiunto.' : 'Limite di 5 documenti raggiunto.'}</p>}
        {error && !(trackingId && draft) && <p className="form-error" role="alert">{error}</p>}
        {feedback && <p className="text-ok" role="status">{feedback}</p>}
    </div>;

    if (trackingId) return <section className="record-detail-section">
        {draft && createPortal(<div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true"
            aria-label={isInvoice ? 'Modifica fattura' : 'Modifica documento di tracciamento'}
            onKeyDown={event => {if (event.key === 'Escape' && !locked) {setDraft(null); setError('');}}}
            onMouseDown={event => {if (event.target === event.currentTarget && !locked) {setDraft(null); setError('');}}}>
            <div className="modal-card">
                <div className="modal-title"><h3>{isInvoice ? 'Modifica fattura' : 'Modifica documento di tracciamento'}</h3>
                    <button type="button" className="btn btn-neutral btn-icon-only modal-close-button" aria-label="Chiudi"
                        disabled={locked} onClick={() => {setDraft(null); setError('');}}>×</button>
                </div>
                <div className="app-record-form">{draftEditor}</div>
                {error && <p className="form-error" role="alert">{error}</p>}
            </div>
        </div>, document.body)}
        <div className="record-detail-section-heading">
            <div>
                <div className="product-tracking-invoice-title"><h2>{title}</h2><span
                    className="badge">{rows.length}/5</span>{rows.length > 0 &&
                    <small className={trackingDocumentAgeClass(latestAge)}
                           title={latestDate ? `Documento più recente: ${formatItalianCompactDate(latestDate)}` : 'Nessuna data documento disponibile'}>· {latestAge.label}</small>}
                </div>
                <p>{isInvoice ? 'Documenti di fattura con la relativa data.' : 'Documenti associati alla tracciatura con la relativa data.'}</p>
            </div>
            <div className="record-detail-section-heading-actions">
                {rows.some(row => row.id) && <a className="btn btn-sm btn-default"
                    href={`/api/product-trackings/${trackingId}/attachments/archive?kind=${kind}`} download
                    aria-label={isInvoice ? 'Scarica tutte le fatture' : 'Scarica tutti i documenti di tracciamento'}>
                    <span className="btn-icon" aria-hidden="true">⇩</span> Scarica tutti
                </a>}
                {addButton}
            </div>
        </div>
        <div className="app-record-form record-detail-payment-summary-list">{content}</div>
    </section>;
    return <details className="form-section full entity-form-section expense-attachments-section" open>
        <summary>
            <span className="info-label-row">
                <span><span className="entity-form-section-icon"
                            aria-hidden="true">▤</span>{title} ({rows.length}/5)</span>
                <InfoHint compactOnly
                          title={title}>{isInvoice ? 'Aggiungi un documento e la data fattura, poi conferma.' : 'Aggiungi un documento di tracciamento e la data documento, poi conferma.'} I documenti saranno salvati con la tracciatura.</InfoHint>
            </span>
            <small
                className="info-hint-desktop-text">{isInvoice ? 'Un documento e una data per ogni fattura' : 'Un documento e una data per ogni allegato, fino a 5 documenti'}</small>
        </summary>
        {content}
    </details>;
}
