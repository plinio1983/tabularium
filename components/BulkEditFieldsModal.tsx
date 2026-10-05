"use client";

import {type ReactNode, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {addCalendarDays, dateInputInTimeZone} from "@/lib/company-time";
import {useCompanyTimeZone} from "@/components/CompanyTimeZoneProvider";
import {DateField, MonthField, SelectField, FormField} from "@/components/FormControls";
import {CurrencyInput} from '@/components/CurrencyInput';
import {applyCurrencyInputKeyWithState, resetCurrencyInput, currencyInputToNumber} from '@/lib/currency-input';
import SupplierAutocomplete, {type SupplierAutocompleteOption} from "@/components/SupplierAutocomplete";
import CustomerAutocomplete from "@/components/CustomerAutocomplete";

export type SingleEditRecord = {
  id: number; expenseType?: string; incomeType?: string; categoryId?: number | null; supplierId?: number | null; merchant?: string | null;
  customerId?: number | null; salesChannelId?: number; receivedDate?: string | Date | null; orderDate?: string | Date | null; dueDate?: string | Date | null;
  month?: number; year?: number; billingMonth?: number | null; billingYear?: number | null; isDeclared?: boolean; isFiscal?: boolean;
  hasElectronicInvoice?: boolean; invoiceStatus?: string | null; vatRate?: string | number | null; amount?: string | number | null; description?: string | null; notes?: string | null;
};
type Props = {
  singleRecord?: SingleEditRecord;
  onClose?: () => void;

  formId: string;
  subject: "spese" | "incassi" | "uscite ricorrenti";
  action?: string;
  categoryFieldName?: string;
  categories?: Array<{value: string; label: string; icon?: string | null}>;
  suppliers?: SupplierAutocompleteOption[];
  supplierEligibleIds?: number[];
  customers?: Array<{id: number; businessName: string; alias?: string | null; systemRole?: string | null}>;
  salesChannels?: Array<{id: number; name: string; icon?: string | null}>;
  editableIds?: number[];
};

type Step = "choice" | "category" | "dates" | "supplier" | "customer" | "salesChannel" | "accounting" | "details" | "notes" | "identity";

function selectedIdsForForm(formId: string) {
  return Array.from(document.querySelectorAll<HTMLInputElement>(
    `input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`,
  )).map(input => input.value);
}

function AccountingField({title, hint, active, name, onActiveChange, children, single = false}: {single?: boolean; title: string; hint: string; active: boolean; name: string; onActiveChange: (value: boolean) => void; children: ReactNode}) {
  return <section className={`bulk-edit-date-card bulk-edit-accounting-card${active ? " is-active" : ""}`}>
    <div className="bulk-edit-date-card-heading"><div><strong>{title}</strong><small>{hint}</small></div>{single ? <input type="hidden" name={name} value="true"/> : <div className="switch-toggle-field switch-clean switch-inline"><label className="switch" aria-label={`Modifica ${title}`}><input type="checkbox" name={name} checked={active} onChange={event => onActiveChange(event.currentTarget.checked)}/><span className="slider"/></label></div>}</div>
    {active ? <div className="bulk-edit-accounting-control">{children}</div> : null}
  </section>;
}

export default function BulkEditFieldsModal({formId, subject, action, categoryFieldName = "categoryId", categories = [], suppliers = [], supplierEligibleIds = [], customers = [], salesChannels = [], editableIds = [], singleRecord, onClose}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const amountKeyState = useRef<{separatorDigits: 0 | 1 | null}>({separatorDigits: null});
  const timeZone = useCompanyTimeZone();
  const [isOpen, setIsOpen] = useState(Boolean(singleRecord));
  const [selectedIds, setSelectedIds] = useState<string[]>(singleRecord ? [String(singleRecord.id)] : []);
  const [step, setStep] = useState<Step>("choice");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [updateOrderDate, setUpdateOrderDate] = useState(Boolean(singleRecord));
  const [updateDueDate, setUpdateDueDate] = useState(Boolean(singleRecord));
  const [orderDate, setOrderDate] = useState((singleRecord?.receivedDate ?? singleRecord?.orderDate) ? new Date((singleRecord?.receivedDate ?? singleRecord?.orderDate)!).toISOString().slice(0, 10) : "");
  const [dueDate, setDueDate] = useState((singleRecord?.dueDate) ? new Date((singleRecord?.dueDate)!).toISOString().slice(0, 10) : "");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(singleRecord?.supplierId ?? null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(singleRecord?.customerId ?? null);
  const [selectedSalesChannelId, setSelectedSalesChannelId] = useState(String(singleRecord?.salesChannelId ?? ""));
  const [updateFiscal, setUpdateFiscal] = useState(Boolean(singleRecord));
  const [fiscalValue, setFiscalValue] = useState(singleRecord?.isDeclared ?? singleRecord?.isFiscal ?? true);
  const [updateVatRate, setUpdateVatRate] = useState(Boolean(singleRecord));
  const [vatRate, setVatRate] = useState(String(singleRecord?.vatRate ?? "22"));
  const [updateBillingPeriod, setUpdateBillingPeriod] = useState(Boolean(singleRecord));
  const [billingPeriod, setBillingPeriod] = useState(singleRecord ? `${singleRecord.year ?? singleRecord.billingYear}-${String(singleRecord.month ?? singleRecord.billingMonth).padStart(2, "0")}` : "");
  const [updateElectronicInvoice, setUpdateElectronicInvoice] = useState(Boolean(singleRecord));
  const [electronicInvoice, setElectronicInvoice] = useState(singleRecord?.hasElectronicInvoice ?? true);
  const [updateInvoiceStatus, setUpdateInvoiceStatus] = useState(Boolean(singleRecord));
  const [invoiceStatus, setInvoiceStatus] = useState(singleRecord?.invoiceStatus ?? (subject === "spese" ? "IN_ATTESA" : "NON_INVIATA"));
  const [amount, setAmount] = useState(String(singleRecord?.amount ?? "0"));
  const hasCategoryStep = Boolean(action && categories.length);
  const hasDatesStep = Boolean(action && subject === "spese");
  const supplierEligibleIdSet = new Set(supplierEligibleIds.map(String));
  const supplierSelectionEligible = selectedIds.length > 0 && selectedIds.every(id => supplierEligibleIdSet.has(id));
  const editableIdSet = new Set(editableIds.map(String));
  const incomeSelectionEligible = subject === "incassi" && selectedIds.length > 0 && selectedIds.every(id => editableIdSet.has(id));
  const selectedDatesInvalid = (singleRecord ? updateOrderDate || updateDueDate : updateOrderDate && updateDueDate) && Boolean(orderDate && dueDate && dueDate < orderDate);
  const fields: Array<{label: string; description: string; icon: string; enabled: boolean; step: Step; status?: string}> = subject === "uscite ricorrenti" ? [
    {label: "Categoria", description: "Assegna una categoria comune", icon: "🏷", enabled: hasCategoryStep, step: "category" as const},
  ] : subject === "spese" ? [
    {label: "Data ordine e scadenza", description: "Aggiorna le date dei record selezionati", icon: "📅", enabled: hasDatesStep, step: "dates" as const},
    {label: "Categoria", description: "Assegna una categoria comune", icon: "🏷", enabled: hasCategoryStep, step: "category" as const},
    {label: "Esercente", description: "Sostituisci il fornitore associato", icon: "🏪", enabled: Boolean(action && subject === "spese" && suppliers.length && supplierSelectionEligible), step: "supplier" as const, status: supplierSelectionEligible ? undefined : "Solo spese standard"},
    {label: "Informazioni fiscali e contabili", description: "Fiscalità, IVA, periodo e fattura", icon: "🧾", enabled: supplierSelectionEligible, step: "accounting" as const, status: supplierSelectionEligible ? undefined : "Solo spese standard"},
  ] : [
    {label: "Data ordine e scadenza", description: "Aggiorna le date dei record selezionati", icon: "📅", enabled: Boolean(action && incomeSelectionEligible), step: "dates" as const, status: incomeSelectionEligible ? undefined : "Solo incassi standard"},
    {label: "Cliente", description: "Assegna un cliente comune", icon: "◎", enabled: Boolean(action && customers.length && incomeSelectionEligible), step: "customer" as const, status: incomeSelectionEligible ? undefined : "Solo incassi standard"},
    {label: "Canale di vendita", description: "Sostituisci il canale associato", icon: "▣", enabled: Boolean(action && salesChannels.length && incomeSelectionEligible), step: "salesChannel" as const, status: incomeSelectionEligible ? undefined : "Solo incassi standard"},
    {label: "Informazioni fiscali e contabili", description: "Fiscalità, IVA, periodo e fattura", icon: "🧾", enabled: Boolean(action && incomeSelectionEligible), step: "accounting" as const, status: incomeSelectionEligible ? undefined : "Solo incassi standard"},
  ];

  if (singleRecord) {
    const groupedSteps = ['category', 'supplier', 'customer', 'salesChannel'];
    for (let index = fields.length - 1; index >= 0; index--) {
      if (groupedSteps.includes(fields[index].step)) fields.splice(index, 1);
    }
    const dates = fields.find(field => field.step === 'dates');
    if (dates) dates.description = 'Modifica le date del documento';
    fields.unshift({label: subject === 'spese' ? 'Esercente, categoria e descrizione' : 'Cliente, canale di vendita e descrizione', description: 'Modifica i dati del documento', icon: '✎', enabled: true, step: 'identity'});
    fields.unshift({label: "Importo", description: "Modifica l’importo del documento", icon: "€", enabled: true, step: "details"});
    fields.push({label: "Note", description: "Modifica le note del documento", icon: "≡", enabled: true, step: "notes"});
  }

  useEffect(() => {
    if (!singleRecord) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('.bulk-edit-field-button')?.focus({preventScroll: true});
    return () => {document.body.style.overflow = previousOverflow; previousFocus?.focus({preventScroll: true});};
  }, [singleRecord?.id]);

  useEffect(() => {
    if (!singleRecord) return;
    const selector = step === 'choice' ? '.bulk-edit-field-button' : '.bulk-edit-form input:not([type="hidden"]), .bulk-edit-form select, .bulk-edit-form textarea, .bulk-edit-form button';
    dialogRef.current?.querySelector<HTMLElement>(selector)?.focus({preventScroll: true});
  }, [step, singleRecord?.id]);

  useEffect(() => {
    if (singleRecord) return;
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<{formId?: string; selectedCount?: number}>).detail;
      if (detail?.formId !== formId) return;
      const ids = selectedIdsForForm(formId);
      if (!ids.length) return;
      setSelectedIds(ids);
      setStep("choice");
      setDirection("forward");
      setUpdateOrderDate(false);
      setUpdateDueDate(false);
      setOrderDate("");
      setDueDate("");
      setSelectedSupplierId(null);
      setSelectedCustomerId(null);
      setSelectedSalesChannelId("");
      setUpdateFiscal(false);
      setFiscalValue(true);
      setUpdateVatRate(false);
      setVatRate("22");
      setUpdateBillingPeriod(false);
      setBillingPeriod("");
      setUpdateElectronicInvoice(false);
      setElectronicInvoice(true);
      setUpdateInvoiceStatus(false);
      setInvoiceStatus("IN_ATTESA");
      setIsOpen(true);
    };
    document.addEventListener("bulk-edit-request", onRequest);
    return () => document.removeEventListener("bulk-edit-request", onRequest);
  }, [formId]);

  function closeModal() {
    setIsOpen(false);
    setStep("choice");
    onClose?.();
  }

  function selectCategory() {
    setDirection("forward");
    setStep("category");
  }

  function selectDates() {
    setDirection("forward");
    setStep("dates");
  }

  function selectSupplier() {
    setDirection("forward");
    setStep("supplier");
  }

  function selectAccounting() {
    if (subject === "incassi" && !["NON_INVIATA", "PARZIALE", "EMESSA"].includes(invoiceStatus)) {
      setInvoiceStatus("NON_INVIATA");
    }
    setDirection("forward");
    setStep("accounting");
  }

  function selectCustomer() {
    setDirection("forward");
    setStep("customer");
  }

  function selectSalesChannel() {
    setDirection("forward");
    setStep("salesChannel");
  }

  function goBack() {
    setDirection("back");
    setStep("choice");
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="app-form-modal-backdrop bulk-category-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) closeModal();
    }} onKeyDown={event => {
      if (!singleRecord || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {event.stopPropagation(); closeModal();}
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    }}>
      <div ref={dialogRef} className="bulk-category-modal bulk-edit-fields-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-bulk-edit-title`}>
        <div className="modal-toolbar-card toolbar-card">
          <div className="bulk-edit-toolbar-copy">
            <span className="bulk-edit-toolbar-kicker">{singleRecord ? "Modifica singola" : "Modifica multipla"}</span>
            <h2 id={`${formId}-bulk-edit-title`}>{step === "choice" ? (singleRecord ? `Modifica ${subject === "spese" ? "spesa" : "incasso"} #${singleRecord.id}` : `Modifica ${subject}`) : step === "identity" ? (subject === "spese" ? "Esercente, categoria e descrizione" : "Cliente, canale di vendita e descrizione") : step === "details" ? "Importo" : step === "notes" ? "Note" : step === "category" ? "Modifica categoria" : step === "dates" ? "Modifica date" : step === "supplier" ? "Modifica esercente" : step === "customer" ? "Modifica cliente" : step === "salesChannel" ? "Modifica canale di vendita" : "Informazioni fiscali e contabili"}</h2>
            <p className="muted"><strong>{selectedIds.length}</strong> {selectedIds.length === 1 ? "record selezionato" : "record selezionati"}</p>
          </div>
          <button type="button" className="btn btn-neutral btn-icon-only modal-close-button bulk-edit-close-button" aria-label={singleRecord ? "Chiudi modifica" : "Chiudi modifica multipla"} onClick={closeModal}><span className="btn-icon" aria-hidden="true">×</span></button>
        </div>
        <div key={step} className={`bulk-edit-step bulk-edit-step-${direction}`}>
          {step === "choice" ? <div className="bulk-edit-form bulk-edit-choice-form">
            <div className="bulk-edit-choice-intro">
              <strong>Cosa vuoi modificare?</strong>
              <span>Scegli un gruppo di informazioni. I campi non selezionati resteranno invariati.</span>
            </div>
            <div className="bulk-edit-fields-list">
              {fields.map(field => <button
                key={field.label}
                type="button"
                className={`bulk-edit-field-button${field.enabled ? "" : " is-disabled"}`}
                disabled={!field.enabled}
                onClick={singleRecord && (field.step === "details" || field.step === "notes" || field.step === "identity") ? () => {setDirection("forward"); setStep(field.step);} : field.step === "category" && field.enabled ? selectCategory : field.step === "dates" && field.enabled ? selectDates : field.step === "supplier" && field.enabled ? selectSupplier : field.step === "customer" && field.enabled ? selectCustomer : field.step === "salesChannel" && field.enabled ? selectSalesChannel : field.step === "accounting" && field.enabled ? selectAccounting : undefined}
              >
                <span className="bulk-edit-field-icon btn-icon" aria-hidden="true">{field.icon}</span>
                <span className="bulk-edit-field-copy"><strong>{field.label}</strong><small>{field.description}</small></span>
                <span className="bulk-edit-field-status">{field.enabled ? <span className="btn-icon">›</span> : field.status ?? "Prossimamente"}</span>
              </button>)}
            </div>
            <div className="bulk-edit-actions">
              <button type="button" className="btn btn-md btn-default" onClick={closeModal}><span className="btn-icon">✕</span> Annulla</button>
            </div>
          </div> : singleRecord && (step === "details" || step === "notes" || step === "identity") ? <form action={action} method="post" className={`bulk-edit-form${step === "details" ? " bulk-edit-amount-form" : ""}`}>
            <input type="hidden" name="bulkAction" value={step === "identity" ? "change_identity" : step === "details" ? "change_amount" : "change_notes"}/>
            <input type="hidden" name="ids" value={singleRecord.id}/>
            <div className="bulk-edit-supplier-content app-form-wizard">
              {step === "details" ? <>
                <input type="hidden" name="amount" value={currencyInputToNumber(amount)}/>
                <div className="income-wizard-amount"><label className="income-amount-field"><div className="app-form-field-label"><span className="app-form-field-icon">€</span><span>Importo</span></div><div className="income-amount-row"><div className="money-input"><span>€</span><CurrencyInput value={amount} onValueChange={value => {amountKeyState.current.separatorDigits = null; setAmount(value);}} suppressSoftKeyboard clearable onClear={() => resetCurrencyInput(amountKeyState.current)} required/></div></div></label></div>
                <div className="app-amount-keypad full" aria-label="Tastiera numerica">{['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'].map(key => <button type="button" key={key} aria-label={key === 'backspace' ? 'Cancella ultima cifra' : key} onMouseDown={event => event.preventDefault()} onClick={() => setAmount(current => applyCurrencyInputKeyWithState(current, key, amountKeyState.current))}>{key === 'backspace' ? <span className="btn-icon">⌫</span> : key}</button>)}</div>
              </> : step === "identity" ? <>
                {subject === 'spese' ? <>
                  <SupplierAutocomplete initialSupplierId={singleRecord.supplierId} initialMerchant={singleRecord.merchant} suppliers={suppliers.filter(supplier => !supplier.systemRole)} categories={categories.map(category => ({id: Number(category.value), name: category.label, icon: category.icon}))} onSupplierSelected={supplier => setSelectedSupplierId(supplier?.id ?? null)} wizardStep={false}/>
                  <FormField label="Categoria" icon="🏷"><select name="categoryId" required defaultValue={singleRecord.categoryId ?? ''}><option value="" disabled>Seleziona categoria</option>{categories.map(category => <option key={category.value} value={category.value}>{category.icon ? `${category.icon} ${category.label}` : category.label}</option>)}</select></FormField>
                </> : <>
                  <CustomerAutocomplete initialCustomerId={singleRecord.customerId} customers={customers.filter(customer => !customer.systemRole)} wizardStepClass="" allowCreate={false} onCustomerSelected={customer => setSelectedCustomerId(customer?.id ?? null)}/>
                  <FormField label="Canale di vendita" icon="▣"><select name="salesChannelId" required value={selectedSalesChannelId} onChange={event => setSelectedSalesChannelId(event.currentTarget.value)}><option value="" disabled>Seleziona canale</option>{salesChannels.map(channel => <option key={channel.id} value={channel.id}>{channel.icon ? `${channel.icon} ${channel.name}` : channel.name}</option>)}</select></FormField>
                </>}
                <FormField label="Descrizione" icon="✎"><textarea name="description" defaultValue={singleRecord.description ?? ''} required={subject === 'spese'}/></FormField>
              </> : <FormField label="Note" icon="≡"><textarea name="notes" defaultValue={singleRecord.notes ?? ''}/></FormField>}
            </div>
            <div className="bulk-edit-actions"><button type="button" className="btn btn-md btn-ghost" onClick={goBack}><span className="btn-icon">‹</span> Indietro</button><button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">✓</span> Salva</button></div>
          </form> : step === "category" ? <form action={action} method="post" className="bulk-edit-form bulk-edit-category-form">
            <input type="hidden" name="bulkAction" value="change_category" />
            {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
            <div className="bulk-edit-category-content">
              <label><span><span className="app-form-label-icon" aria-hidden="true">🏷</span> Categoria</span>
                <select name={categoryFieldName} required defaultValue={singleRecord?.categoryId ?? ""}>
                  <option value="" disabled>Seleziona categoria</option>
                  {categories.map(category => <option key={category.value} value={category.value}>
                    {category.icon ? `${category.icon} ${category.label}` : category.label}
                  </option>)}
                </select>
              </label>
            </div>
            <div className="bulk-edit-actions">
              <button type="button" className="btn btn-md btn-ghost" onClick={goBack}><span className="btn-icon">‹</span> Indietro</button>
              <button type="submit" className="btn btn-md btn-primary"><span className="btn-icon">✓</span> Conferma</button>
            </div>
          </form> : step === "dates" ? <form action={action} method="post" className="bulk-edit-form bulk-edit-dates-form">
            <input type="hidden" name="bulkAction" value="change_dates" />
            {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
            <div className="bulk-edit-dates-content">
              <section className={`bulk-edit-date-card${updateOrderDate ? " is-active" : ""}`}>
                <div className="bulk-edit-date-card-heading">
                  <div><strong>Data ordine</strong><small>{singleRecord ? "Modifica la data ordine" : "Assegna la stessa data ordine ai record selezionati"}</small></div>
                  {singleRecord ? <input type="hidden" name="updateOrderDate" value="true"/> : <div className="switch-toggle-field switch-clean switch-inline"><label className="switch" aria-label="Modifica data ordine"><input type="checkbox" name="updateOrderDate" checked={updateOrderDate} onChange={event => setUpdateOrderDate(event.currentTarget.checked)}/><span className="slider"/></label></div>}
                </div>
                {updateOrderDate ? <div className="app-form-wizard bulk-edit-date-control-scope"><DateField label="Nuova data ordine" name="orderDate" value={orderDate} onChange={setOrderDate} required/></div> : null}
              </section>
              <section className={`bulk-edit-date-card${updateDueDate ? " is-active" : ""}`}>
                <div className="bulk-edit-date-card-heading">
                  <div><strong>Data scadenza</strong><small>La scadenza non può essere rimossa</small></div>
                  {singleRecord ? <input type="hidden" name="updateDueDate" value="true"/> : <div className="switch-toggle-field switch-clean switch-inline"><label className="switch" aria-label="Modifica data scadenza"><input type="checkbox" name="updateDueDate" checked={updateDueDate} onChange={event => setUpdateDueDate(event.currentTarget.checked)}/><span className="slider"/></label></div>}
                </div>
                {updateDueDate ? <div className="app-form-wizard bulk-edit-date-control-scope"><DateField label="Nuova data scadenza" name="dueDate" value={dueDate} onChange={setDueDate} required>
                  <span className="app-due-date-shortcuts" aria-label="Selezione rapida data scadenza">{[0, 7, 15, 30].map(days => {
                    const base = updateOrderDate && orderDate ? orderDate : dateInputInTimeZone(timeZone);
                    const value = addCalendarDays(base, days);
                    return <button type="button" key={days} className={dueDate === value ? "is-selected" : ""} onClick={() => setDueDate(value)}>{days === 0 ? "Stesso g" : `+${days} gg`}</button>;
                  })}</span>
                </DateField></div> : null}
              </section>
              {!updateOrderDate && !updateDueDate ? <p className="muted bulk-edit-dates-hint">Attiva almeno una data da modificare.</p> : null}
              {selectedDatesInvalid ? <p className="inline-form-error bulk-edit-dates-hint">La scadenza non può precedere la data ordine.</p> : null}
            </div>
            <div className="bulk-edit-actions">
              <button type="button" className="btn btn-md btn-ghost" onClick={goBack}><span className="btn-icon">‹</span> Indietro</button>
              <button type="submit" className="btn btn-md btn-primary" disabled={(!updateOrderDate && !updateDueDate) || (updateOrderDate && !orderDate) || (updateDueDate && !dueDate) || selectedDatesInvalid}><span className="btn-icon">✓</span> Conferma</button>
            </div>
          </form> : step === "supplier" ? <form action={action} method="post" className="bulk-edit-form bulk-edit-supplier-form">
            <input type="hidden" name="bulkAction" value="change_supplier" />
            {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
            <div className="bulk-edit-supplier-content app-form-wizard">
              <SupplierAutocomplete
                initialSupplierId={singleRecord?.supplierId} initialMerchant={singleRecord?.merchant}
                suppliers={suppliers.filter(supplier => !supplier.systemRole)}
                categories={categories.map(category => ({id: Number(category.value), name: category.label, icon: category.icon}))}
                onSupplierSelected={supplier => setSelectedSupplierId(supplier?.id ?? null)}
                wizardStep={false}
              />
              <p className="muted">La categoria delle spese rimarrà invariata.</p>
            </div>
            <div className="bulk-edit-actions">
              <button type="button" className="btn btn-md btn-ghost" onClick={goBack}><span className="btn-icon">‹</span> Indietro</button>
              <button type="submit" className="btn btn-md btn-primary" disabled={!selectedSupplierId}><span className="btn-icon">✓</span> Conferma</button>
            </div>
          </form> : step === "customer" ? <form action={action} method="post" className="bulk-edit-form bulk-edit-supplier-form">
            <input type="hidden" name="bulkAction" value="change_customer" />
            {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
            <div className="bulk-edit-supplier-content app-form-wizard">
              <CustomerAutocomplete initialCustomerId={singleRecord?.customerId} customers={customers.filter(customer => !customer.systemRole)} wizardStepClass="" allowCreate={false} onCustomerSelected={customer => setSelectedCustomerId(customer?.id ?? null)}/>
            </div>
            <div className="bulk-edit-actions"><button type="button" className="btn btn-md btn-ghost" onClick={goBack}><span className="btn-icon">‹</span> Indietro</button><button type="submit" className="btn btn-md btn-primary" disabled={!selectedCustomerId}><span className="btn-icon">✓</span> Conferma</button></div>
          </form> : step === "salesChannel" ? <form action={action} method="post" className="bulk-edit-form bulk-edit-category-form">
            <input type="hidden" name="bulkAction" value="change_sales_channel" />
            {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
            <div className="bulk-edit-category-content"><label><span><span className="app-form-label-icon" aria-hidden="true">▣</span> Canale di vendita</span><select name="salesChannelId" required value={selectedSalesChannelId} onChange={event => setSelectedSalesChannelId(event.currentTarget.value)}><option value="" disabled>Seleziona canale</option>{salesChannels.map(channel => <option key={channel.id} value={channel.id}>{channel.icon ? `${channel.icon} ${channel.name}` : channel.name}</option>)}</select></label></div>
            <div className="bulk-edit-actions"><button type="button" className="btn btn-md btn-ghost" onClick={goBack}><span className="btn-icon">‹</span> Indietro</button><button type="submit" className="btn btn-md btn-primary" disabled={!selectedSalesChannelId}><span className="btn-icon">✓</span> Conferma</button></div>
          </form> : <form action={action} method="post" className="bulk-edit-form bulk-edit-accounting-form">
            <input type="hidden" name="bulkAction" value="change_accounting" />
            {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
            <div className="bulk-edit-accounting-content">
              <AccountingField single={Boolean(singleRecord)} title={subject === "spese" ? "Dichiarazione / Detrazione" : "Natura dell’incasso"} hint="Fiscale o non fiscale" active={updateFiscal} name="updateFiscal" onActiveChange={setUpdateFiscal}>
                <input type="hidden" name="fiscalValue" value={fiscalValue ? "true" : "false"}/>
                <div className="btn-group bulk-edit-segmented-control"><button type="button" className={`btn btn-md ${fiscalValue ? "btn-primary" : "btn-default"}`} onClick={() => {setFiscalValue(true); if (subject === "incassi" && !["NON_INVIATA", "PARZIALE", "EMESSA"].includes(invoiceStatus)) setInvoiceStatus("NON_INVIATA");}}>Fiscale</button><button type="button" className={`btn btn-md ${!fiscalValue ? "btn-primary" : "btn-default"}`} onClick={() => {setFiscalValue(false); setVatRate("0"); setElectronicInvoice(false); setInvoiceStatus(subject === "spese" ? "NON_PREVISTA" : "NON_INVIATA");}}>Non fiscale</button></div>
              </AccountingField>
              <AccountingField single={Boolean(singleRecord)} title="Aliquota IVA" hint="Aliquota applicata all’importo" active={updateVatRate} name="updateVatRate" onActiveChange={setUpdateVatRate}>
                <input type="hidden" name="vatRate" value={vatRate}/><div className="app-vat-rate-buttons bulk-edit-vat-buttons">{["0", "4", "10", "22"].map(rate => <button type="button" key={rate} className={vatRate === rate ? "is-selected" : ""} onClick={() => setVatRate(rate)}>{rate}%</button>)}</div>
              </AccountingField>
              <AccountingField single={Boolean(singleRecord)} title="Periodo contabile" hint="Mese utilizzato nei report" active={updateBillingPeriod} name="updateBillingPeriod" onActiveChange={setUpdateBillingPeriod}>
                <div className="app-form-wizard bulk-edit-date-control-scope"><MonthField label="Nuovo periodo contabile" name="billingPeriod" value={billingPeriod} onChange={setBillingPeriod} required/></div>
              </AccountingField>
              {subject === "spese" ? <AccountingField single={Boolean(singleRecord)} title="Tipo di fattura" hint="Documento PDF o fattura elettronica" active={updateElectronicInvoice} name="updateElectronicInvoice" onActiveChange={setUpdateElectronicInvoice}>
                <input type="hidden" name="electronicInvoice" value={electronicInvoice ? "true" : "false"}/><div className="btn-group bulk-edit-segmented-control"><button type="button" className={`btn btn-md ${!electronicInvoice ? "btn-primary" : "btn-default"}`} onClick={() => setElectronicInvoice(false)}>PDF</button><button type="button" className={`btn btn-md ${electronicInvoice ? "btn-primary" : "btn-default"}`} onClick={() => {setElectronicInvoice(true); if (invoiceStatus === "NON_PREVISTA") setInvoiceStatus("IN_ATTESA");}}>Elettronica</button></div>
              </AccountingField> : null}
              <AccountingField single={Boolean(singleRecord)} title="Stato fattura" hint="Stato del documento fiscale" active={updateInvoiceStatus} name="updateInvoiceStatus" onActiveChange={setUpdateInvoiceStatus}>
                <SelectField label="Nuovo stato fattura" name="invoiceStatus" value={invoiceStatus} onChange={setInvoiceStatus} options={subject === "spese" ? [{value: "NON_PREVISTA", label: "Non prevista", disabled: updateElectronicInvoice && electronicInvoice}, {value: "IN_ATTESA", label: "⏳ In attesa"}, {value: "PARZIALE", label: "◐ Fatturato parzialmente"}, {value: "RICEVUTA", label: "✅ Emessa"}, {value: "CONTESTAZIONE", label: "⚠️ Contestazione"}] : [{value: "NON_INVIATA", label: "Non inviata"}, {value: "PARZIALE", label: "◐ Fatturato parzialmente"}, {value: "EMESSA", label: "✅ Emessa"}]}/>
              </AccountingField>
            </div>
            <div className="bulk-edit-actions"><button type="button" className="btn btn-md btn-ghost" onClick={goBack}><span className="btn-icon">‹</span> Indietro</button><button type="submit" className="btn btn-md btn-primary" disabled={!(updateFiscal || updateVatRate || updateBillingPeriod || (subject === "spese" && updateElectronicInvoice) || updateInvoiceStatus) || (updateBillingPeriod && !billingPeriod)}><span className="btn-icon">✓</span> Conferma</button></div>
          </form>}
          </div>
      </div>
    </div>,
    document.body,
  );
}
