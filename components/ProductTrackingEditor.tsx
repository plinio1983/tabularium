'use client';

import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useRouter} from 'next/navigation';
import MobileFormStickyActions from '@/components/MobileFormStickyActions';
import {normalizeTrackingStep, trackingDocumentError, trackingWizardSteps} from '@/lib/product-tracking-wizard';
import {DateField, FormField} from '@/components/FormControls';
import InfoHint from '@/components/InfoHint';
import ProductTrackingDocuments from '@/components/ProductTrackingDocuments';
import {appendTrackingDocuments, type TrackingDocumentFormState} from '@/lib/product-tracking-document';
import ProductTrackingInvoices from '@/components/ProductTrackingInvoices';
import {appendTrackingInvoices, invoiceRow, type TrackingInvoiceFormState} from '@/lib/product-tracking-invoice';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {dateInputInTimeZone} from '@/lib/company-time';
import {appendFlash} from '@/lib/flash';
import {preparePageReturn} from '@/lib/page-transition';

export type TrackingEditorRecord = {
  id: number; name: string; batch: string; batchYear: number; alias: string | null; entryDate: string;
  attachments: {id: number; kind: 'INVOICE' | 'TRACKING'; originalName: string; invoiceDate: string; documentDate?: string; sizeBytes?: number | null}[];
};

export default function ProductTrackingEditor({record, returnTo = '/product-trackings', initiallyOpen = false, className, initialMobileStep = 1, openNewInvoice = false, openNewDocument = false, disabled = false, mobileHeaderAction = false, triggerLabel, onClose}: {
  onClose?: () => void; triggerLabel?: string; record?: TrackingEditorRecord; returnTo?: string; initiallyOpen?: boolean; className?: string; initialMobileStep?: number; openNewInvoice?: boolean; openNewDocument?: boolean; disabled?: boolean; mobileHeaderAction?: boolean;
}) {
  const router = useRouter();
  const timeZone = useCompanyTimeZone();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [entryDate, setEntryDate] = useState(() => record?.entryDate ?? '');
  const initialInvoices = useMemo(() => record?.attachments.filter(a => a.kind === 'INVOICE') ?? [], [record?.attachments]);
  const [invoiceState, setInvoiceState] = useState<TrackingInvoiceFormState>(() => ({rows: initialInvoices.map(invoiceRow), removedIds: [], hasDraft: openNewInvoice && initialInvoices.length < 5}));
  const initialDocuments = useMemo(() => record?.attachments.filter(a => a.kind === 'TRACKING') ?? [], [record?.attachments]);
  const [documentState, setDocumentState] = useState<TrackingDocumentFormState>(() => ({rows: initialDocuments.map(invoiceRow), removedIds: [], hasDraft: openNewDocument && initialDocuments.length < 5}));
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [mobileStep, setMobileStep] = useState(() => normalizeTrackingStep(initialMobileStep));
  const trackingError = trackingDocumentError(0, documentState.rows.flatMap(row => row.file ? [row.file] : []));
  const overLimit = documentState.rows.length > 5 || invoiceState.rows.length > 5;
  const close = useCallback(() => {
    if (saving) return;
    setOpen(false);
    if (onClose) onClose();
    else if (initiallyOpen) {preparePageReturn(returnTo); router.push(returnTo);}
  }, [saving, initiallyOpen, returnTo, router, onClose]);

  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open || !mounted) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {if (event.key === 'Escape') closeRef.current();};
    document.addEventListener('keydown', onKeyDown);
    return () => {document.removeEventListener('keydown', onKeyDown); if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});};
  }, [open, mounted]);

  function startEditing() {
    if (disabled || saving) return;
    setDocumentState({rows: initialDocuments.map(invoiceRow), removedIds: [], hasDraft: openNewDocument && initialDocuments.length < 5});
    setInvoiceState({rows: initialInvoices.map(invoiceRow), removedIds: [], hasDraft: openNewInvoice && initialInvoices.length < 5});
    setMobileStep(normalizeTrackingStep(initialMobileStep));
    setEntryDate(record?.entryDate ?? ''); setError(''); setOpen(true);
  }
  function goToMobileStep(step: number) {
    if (saving) return;
    setMobileStep(normalizeTrackingStep(step));
  }
  function revealInvalid(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    const step = field.closest<HTMLElement>('[data-tracking-step]')?.dataset.trackingStep;
    if (step) setMobileStep(normalizeTrackingStep(step));
    let section = field.closest('details');
    while (section) {section.open = true; section = section.parentElement?.closest('details') ?? null;}
    window.requestAnimationFrame(() => {field.reportValidity(); field.focus();});
  }
  function validateFields(scope: HTMLElement | null) {
    if (!scope) return true;
    const fields = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
    const invalid = fields.find(field => {
      if (field.disabled) return false;
      if (field instanceof HTMLInputElement && ['name', 'batch'].includes(field.name)) field.setCustomValidity(field.value.trim() ? '' : 'Compila questo campo.');
      return !field.checkValidity();
    });
    if (invalid) {revealInvalid(invalid); return false;}
    return true;
  }
  function nextMobileStep() {
    if (saving) return;
    if (mobileStep === 2 && documentState.hasDraft) {setError('Conferma o annulla il documento aperto prima di proseguire.'); return;}
    if (mobileStep === 2 && trackingError) {setError(trackingError); return;}
    if (!validateFields(formRef.current?.querySelector<HTMLElement>(`[data-tracking-step="${mobileStep}"]`) ?? null)) return;
    setError(''); goToMobileStep(mobileStep + 1);
  }
  useEffect(() => {
    if (!open || !mounted) return;
    const media = window.matchMedia('(max-width: 900px)');
    const focusStep = () => {
      if (!media.matches && initialMobileStep === 1) return;
      window.requestAnimationFrame(() => {
        const section = formRef.current?.querySelector<HTMLElement>(`[data-tracking-step="${mobileStep}"]`);
        section?.querySelectorAll('details').forEach(item => {item.open = true;});
        if (section instanceof HTMLDetailsElement) section.open = true;
        section?.scrollIntoView({behavior: 'smooth', block: 'start'});
        section?.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus({preventScroll: true});
      });
    };
    focusStep(); media.addEventListener('change', focusStep);
    return () => media.removeEventListener('change', focusStep);
  }, [mobileStep, open, mounted, initialMobileStep]);
  const title = record ? 'Modifica tracciatura' : 'Nuova tracciatura';
  const mobileHeader = mobileHeaderAction && mounted ? document.getElementById('product-tracking-mobile-header-actions') : null;
  return <>
    {mobileHeader && !record && !initiallyOpen && createPortal(<button type="button" className="btn btn-sm btn-primary" onClick={startEditing} disabled={disabled || saving}>
      <span className="btn-icon btn-icon-add" aria-hidden="true">＋</span>Nuova tracciatura
    </button>, mobileHeader)}
    {!initiallyOpen && <button type="button" className={className ?? (record ? 'btn btn-sm btn-default' : 'btn btn-sm btn-primary btn-stretch')} onClick={startEditing} disabled={disabled}>
      <span className={record && !openNewInvoice && !openNewDocument ? 'btn-icon' : 'btn-icon btn-icon-add'} aria-hidden="true">{record && !openNewInvoice && !openNewDocument ? '✎' : '＋'}</span>{triggerLabel ?? (openNewDocument ? 'Aggiungi documento' : openNewInvoice ? 'Aggiungi fattura' : record ? 'Modifica' : 'Nuova tracciatura')}
    </button>}
    {mounted && open && createPortal(<div className="modal-backdrop app-form-modal product-tracking-modal" role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={event => {if (event.target === event.currentTarget) close();}}>
      <div className="modal-card modal-card-wide entity-form-modal-card">
        <div className="modal-title"><div><h3>{title}</h3><p className="muted">Dati della merce e documenti associati.</p></div>
          <button type="button" className="btn btn-neutral btn-icon-only modal-close-button" aria-label="Chiudi" onClick={close} disabled={saving}><span className="btn-icon">×</span></button>
        </div>
        <form id={formId} ref={formRef} noValidate className={`card form app-record-form entity-form entity-styled-form inline-create-form app-form-wizard product-tracking-wizard app-form-wizard-current-${mobileStep}`} onInvalidCapture={event => {
          // Reveal invalid required fields before the browser moves focus to them.
          const target = event.target as HTMLElement;
          const invalidStep = target.closest<HTMLElement>('[data-tracking-step]')?.dataset?.trackingStep;
          if (invalidStep) setMobileStep(normalizeTrackingStep(invalidStep));
          let section = target.closest('details');
          while (section) {section.open = true; section = section.parentElement?.closest('details') ?? null;}
        }} onSubmit={async event => {
          event.preventDefault();
          if (saving) return;
          if (window.matchMedia('(max-width: 900px)').matches && mobileStep < 3) {nextMobileStep(); return;}
          if (documentState.hasDraft) {setMobileStep(2); setError('Conferma o annulla il documento di tracciamento aperto prima di salvare.'); return;}
          if (invoiceState.hasDraft) {setMobileStep(3); setError('Conferma o annulla la fattura aperta prima di salvare.'); return;}
          if (trackingError) {setMobileStep(2); setError(trackingError); return;}
          if (overLimit || !validateFields(formRef.current)) return;
          const data = new FormData(event.currentTarget);
          try {appendTrackingDocuments(data, documentState); appendTrackingInvoices(data, invoiceState);} catch (err) {setError(err instanceof Error ? err.message : 'Controlla i documenti e le fatture.'); return;}
          setSaving(true); setError('');
          try {
            const response = await fetch(`/api/product-trackings${record ? `/${record.id}` : ''}`, {method: 'POST', body: data});
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Impossibile salvare la tracciatura.');
            setOpen(false); onClose?.(); preparePageReturn(returnTo);
            router.push(appendFlash(returnTo, {saved: record ? 'updated' : 'created'})); router.refresh();
          } catch (err) {setError(err instanceof Error ? err.message : 'Impossibile salvare la tracciatura.');}
          finally {setSaving(false);}
        }}>
          <div className="app-form-wizard-header full">
            <div className="app-form-wizard-heading"><span>Passaggio {mobileStep} di 3</span><strong>{trackingWizardSteps[mobileStep - 1].title}</strong></div>
            <InfoHint compactOnly title="Informazioni sul passaggio">{trackingWizardSteps[mobileStep - 1].description}</InfoHint>
            <div className="app-form-wizard-progress" aria-label={`Passaggio ${mobileStep} di 3`}><span style={{width: `${mobileStep / 3 * 100}%`}}/></div>
          </div>
          <fieldset disabled={saving} className="full product-tracking-fields">
            <details className="form-section full entity-form-section app-form-wizard-step app-form-wizard-step-1" data-tracking-step="1" open>
              <summary><span className="info-label-row"><span><span className="entity-form-section-icon" aria-hidden="true">▤</span>Merce</span><InfoHint compactOnly title="Merce">Riferimento, lotto e anno obbligatori; nome e data ingresso facoltativi.</InfoHint></span><small className="info-hint-desktop-text">Riferimento, lotto e anno obbligatori</small></summary>
              <div className="form-section-grid entity-form-section-grid">
                <FormField label="Riferimento *" icon="▤" htmlFor={`${formId}-name`}><input id={`${formId}-name`} name="name" required autoFocus={initialMobileStep === 1} onChange={event => event.currentTarget.setCustomValidity('')} maxLength={250} defaultValue={record?.name} placeholder="Riferimento del prodotto"/></FormField>
                <FormField label="Lotto *" icon="#" htmlFor={`${formId}-batch`}><input id={`${formId}-batch`} name="batch" required onChange={event => event.currentTarget.setCustomValidity('')} maxLength={250} autoComplete="off" defaultValue={record?.batch} placeholder="Es. LOT-001"/></FormField>
                <FormField label="Anno *" icon="▦" htmlFor={`${formId}-batchYear`}><input id={`${formId}-batchYear`} name="batchYear" type="number" required min={1000} max={9999} step={1} defaultValue={record?.batchYear ?? Number(dateInputInTimeZone(timeZone).slice(0, 4))}/></FormField>
                <FormField label="Nome" icon="◇" htmlFor={`${formId}-alias`}><input id={`${formId}-alias`} name="alias" maxLength={250} defaultValue={record?.alias ?? ''} placeholder="Nome del prodotto"/></FormField>
                <DateField label="Data ingresso" name="entryDate" value={entryDate} onChange={setEntryDate}/>
              </div>
            </details>
            <div className="full app-form-wizard-step app-form-wizard-step-2" data-tracking-step="2">
              <ProductTrackingDocuments initialDocuments={initialDocuments} onStateChange={setDocumentState} disabled={saving} initiallyAddDocument={openNewDocument}/>
            </div>
            <div className="full app-form-wizard-step app-form-wizard-step-3" data-tracking-step="3">
              <ProductTrackingInvoices initialInvoices={initialInvoices} onStateChange={setInvoiceState} disabled={saving} initiallyAddInvoice={openNewInvoice}/>
            </div>
          </fieldset>
          {overLimit && <p role="alert" className="full form-error">Massimo 5 documenti per categoria. Rimuovi i documenti in eccesso.</p>}
          {error && <p role="alert" className="full form-error">{error}</p>}
          <div className="full actions-row form-actions-row form-sticky-actions entity-form-actions product-tracking-desktop-actions">
            <button className="btn btn-md btn-default" type="button" onClick={close} disabled={saving}><span className="btn-icon">✕</span> Annulla</button>
            <button className="btn btn-md btn-primary" type="submit" disabled={saving || overLimit || !!trackingError || invoiceState.hasDraft || documentState.hasDraft}><span className="btn-icon">✓</span> {saving ? 'Salvataggio…' : 'Salva tracciatura'}</button>
          </div>
          <MobileFormStickyActions currentStep={mobileStep} submitStep={3} onBack={() => goToMobileStep(mobileStep - 1)} onNext={nextMobileStep} onCancel={close} submitLabel="Salva tracciatura" isSubmitting={saving} nextDisabled={saving || mobileStep === 2 && (!!trackingError || documentState.hasDraft)} submitDisabled={overLimit || !!trackingError || invoiceState.hasDraft || documentState.hasDraft} error={error}/>
        </form>
      </div>
    </div>, document.body)}
  </>;
}
