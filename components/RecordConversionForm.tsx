'use client';

import {useRef, useState, type ComponentProps, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import CounterExpenseForm from './CounterExpenseForm';
import ExpenseTypeStep from './ExpenseTypeStep';
import RecordConversionModal from './RecordConversionModal';
import ExpenseTypeChoice, {type ExpenseCreationType} from './ExpenseTypeChoice';
import MobileFormStickyActions from './MobileFormStickyActions';
import ExpenseForm from '@/components/ExpenseForm';
import IncomeForm from '@/components/IncomeForm';
import {conversionLabels, expenseConversionDefaults, expenseConversionTypes, type ExpenseConversionType} from '@/lib/record-conversion';

type ExpenseProps = ComponentProps<typeof ExpenseForm>;
type IncomeProps = ComponentProps<typeof IncomeForm>;
export type RecordConversionFormProps = {id: number; snapshot: string; returnHref: string; onClose?: () => void; onSaved?: () => void} & (
    {kind: 'expenses'; sourceType: ExpenseConversionType; formProps: ExpenseProps} |
    {kind: 'incomes'; sourceType: 'STANDARD' | 'CASH_REGISTER'; formProps: IncomeProps}
);
type Review = {warnings?: string[]; reviewToken: string; changes: Array<{label: string; before: string; after: string}>};

export default function RecordConversionForm(props: RecordConversionFormProps) {
    const router = useRouter();
    const inModal = props.kind === 'expenses' || Boolean(props.onClose);
    const typeLabel = (type: string) => type === 'STANDARD' ? props.kind === 'expenses' ? 'Spesa singola' : 'Incasso singolo' : conversionLabels[type];
    const targets = props.kind === 'expenses' ? expenseConversionTypes : ['STANDARD', 'CASH_REGISTER'];
    const [target, setTarget] = useState('');
    const [typeConfirmed, setTypeConfirmed] = useState(false);
    const choiceTypes: Record<ExpenseConversionType, ExpenseCreationType> = {STANDARD: 'single', PAYROLL: 'payroll', TAX_CONTRIBUTION: 'tax', COUNTER: 'counter'};
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [error, setError] = useState('');
    const [review, setReview] = useState<Review | null>(null);
    const pending = useRef<FormData | null>(null);
    const errorMessage = useRef<HTMLParagraphElement>(null);
    const reviewHeading = useRef<HTMLHeadingElement>(null);

    async function submit(data: FormData, confirmed = false) {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setError('');
        data.set('targetType', target);
        data.set('snapshot', props.snapshot);
        data.set('confirmed', String(confirmed));
        if (confirmed && review) data.set('reviewToken', review.reviewToken);
        try {
            const response = await fetch(`/api/${props.kind}/${props.id}/convert`, {method: 'POST', body: data});
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Impossibile verificare la conversione.');
            if (payload.saved) {
                if (props.onSaved) props.onSaved();
                else if (props.kind === 'expenses') router.replace(props.returnHref, {scroll: false});
                else router.push(props.returnHref);
                router.refresh();
            } else {
                pending.current = data;
                setReview(payload);
                requestAnimationFrame(() => reviewHeading.current?.focus());
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Connessione non disponibile. Riprova.');
            requestAnimationFrame(() => errorMessage.current?.focus());
        }
        finally { busyRef.current = false; setBusy(false); }
    }

    const close = () => {if (!busyRef.current) {if (props.onClose) props.onClose(); else router.replace(props.returnHref, {scroll: false});}};
    const preserved = target === 'COUNTER' ? props.kind === 'expenses' && props.formProps.initialExpense?.payments?.length ? 'La spesa sarà interamente pagata: il primo pagamento sarà portato all’importo totale e gli eventuali successivi saranno eliminati. Gli allegati rimangono collegati.' : 'La spesa sarà interamente pagata: verrà creato un pagamento dell’importo totale con i dati indicati. Gli allegati rimangono collegati.' : 'Pagamenti, accrediti e allegati rimangono collegati allo stesso record. Per modificarli usa le rispettive funzioni dopo la conversione.';
    const payrollNote = 'L’importo originale è proposto come netto. Completa dipendente e periodo lavorato; verifica gli eventuali compensi extra.';
    const typeChoice = props.kind === 'expenses' ? <ExpenseTypeChoice title="Seleziona il tipo in cui convertire" selected={choiceTypes[target as ExpenseConversionType]}
                        availableTypes={expenseConversionTypes.map(type => choiceTypes[type])} disabledTypes={[choiceTypes[props.sourceType as ExpenseConversionType]]} showCounter onSelectCounter={() => {if (props.sourceType !== 'COUNTER') {setTarget('COUNTER'); setError('');}}} disabled={busy}
                        onSelect={choice => {
                            const type = expenseConversionTypes.find(type => choiceTypes[type] === choice);
                            if (type && type !== props.sourceType) {setTarget(type); setError('');}
                        }}/> : null;
    const content = <>
            <p className="field-note record-conversion-note">{preserved}</p>
            {error ? <p className="text-critical" role="alert" tabIndex={-1} ref={errorMessage}>{error}</p> : null}
            <div hidden={Boolean(review)} className={props.kind === 'expenses' ? `expense-creation-stage ${typeConfirmed ? 'is-confirmed' : ''}` : undefined}>
                {props.kind === 'expenses' ? <>
                    <div className="form app-record-form single-expense-form app-form-wizard hidden-md-down">{typeChoice}</div>
                    <ExpenseTypeStep totalSteps={target === 'COUNTER' ? 3 : target === 'STANDARD' ? 7 : 6} confirmed={typeConfirmed}>
                        {typeChoice}
                    {!typeConfirmed && !review ? <MobileFormStickyActions currentStep={1} submitStep={2} onBack={() => undefined} onNext={() => setTypeConfirmed(true)} nextDisabled={!target || busy} onCancel={close} submitLabel="Avanti"/> : null}
                    </ExpenseTypeStep>
                </> : <>
                <label className="full">Converti in
                    <select value={target} disabled={busy} onChange={event => {setTarget(event.target.value); setError('');}}>
                        <option value="">Seleziona il nuovo tipo</option>
                        {targets.map(type => <option key={type} value={type} disabled={type === props.sourceType}>{typeLabel(type)}{type === props.sourceType ? " (attuale)" : ""}</option>)}
                    </select>
                </label>
                </>}
                {target ? <fieldset className={props.kind === 'expenses' ? 'expense-creation-form-stage' : undefined} disabled={busy} style={{border: 0, padding: 0, margin: 0, minWidth: 0}}>
                    {props.kind === 'expenses' ? <>
                        {target === 'PAYROLL' ? <p className="field-note record-conversion-note">{payrollNote}</p> : null}
                        {target === 'COUNTER' ? <CounterExpenseForm key={target} categories={props.formProps.categories} banks={props.formProps.banks} paymentMethods={props.formProps.paymentMethods}
                            initialExpense={{...props.formProps.initialExpense, amount: props.formProps.initialExpense?.amount?.toString(), vatRate: [0, 4, 10, 22].includes(Number(props.formProps.initialExpense?.vatRate)) ? Number(props.formProps.initialExpense?.vatRate) : 22, payments: props.formProps.initialExpense?.payments?.slice(0, 1)}}
                            lockPayment={Boolean(props.formProps.initialExpense?.payments?.length)} mobileStepOffset={1} onBackToType={() => setTypeConfirmed(false)} onCancel={close}
                            hideMobileActions={!typeConfirmed || Boolean(review) || busy} onSubmitData={data => void submit(data)} submitLabel="Verifica conversione"/>
                        : <ExpenseForm key={target} {...props.formProps}
                            initialExpense={expenseConversionDefaults(props.formProps.initialExpense!, target as ExpenseConversionType)}
                            action={`/api/${props.kind}/${props.id}/convert`} preserveLinkedRecords mobileStepOffset={1} onBackToType={() => setTypeConfirmed(false)} onCancel={close}
                            hideMobileActions={!typeConfirmed || Boolean(review) || busy} onSubmitData={data => void submit(data)} submitLabel="Verifica conversione" cancelHref={props.returnHref}/>}
                    </> : target === 'STANDARD' ? <IncomeForm key={target} {...props.formProps}
                        initialIncome={{...props.formProps.initialIncome, customerId: null}}
                        action={`/api/${props.kind}/${props.id}/convert`} preserveLinkedRecords onCancel={close} hideMobileActions={Boolean(review) || busy} onSubmitData={data => void submit(data)} submitLabel="Verifica conversione" cancelHref={props.returnHref}/>
                        : <CashConversionForm formProps={props.formProps} onSubmit={data => void submit(data)}/>}
                </fieldset> : null}
            </div>
            {review ? <form className={`card record-conversion-review${inModal ? ' app-record-form app-form-wizard' : ''}`} onSubmit={event => {
                event.preventDefault();
                if (pending.current) void submit(pending.current, true);
            }}>
                <h3 tabIndex={-1} ref={reviewHeading}>Conferma conversione in {typeLabel(target)}</h3>
                <p>Verifica i dati che cambieranno. I campi specifici del tipo precedente saranno rimossi; gli allegati conserveranno la classificazione attuale.</p>
                {review.warnings?.map(warning => <p key={warning} role="alert" className="text-critical">{warning}</p>)}
                <dl>{review.changes.map(change => <div key={change.label} className="conversion-change"><dt>{change.label}</dt><dd>{change.before} → <strong>{change.after}</strong></dd></div>)}</dl>
                <div className={inModal ? 'actions-row full form-actions-row form-sticky-actions' : 'form-actions'}>
                    <button type="button" className="btn btn-md btn-default" disabled={busy} onClick={() => setReview(null)}><span className="btn-icon">←</span> Torna al form</button>
                    <button type="submit" className="btn btn-md btn-primary" disabled={busy}><span className="btn-icon">✓</span> {busy ? 'Conversione…' : 'Conferma conversione'}</button>
                </div>
                {inModal ? <MobileFormStickyActions currentStep={2} submitStep={2} onBack={() => {if (!busy) setReview(null);}} onNext={() => undefined} backLabel="Torna al form" submitLabel="Conferma conversione" submittingLabel="Conversione…" isSubmitting={busy}/> : null}
            </form> : null}
    </>;
    if (inModal) return <RecordConversionModal title={`Converti ${props.kind === 'expenses' ? 'spesa' : 'incasso'} #${props.id}`} description={`Tipo attuale: ${typeLabel(props.sourceType)}`} help={<><p>{preserved}</p>{target === 'PAYROLL' ? <p>{payrollNote}</p> : null}</>} busy={busy} onClose={close}>{content}</RecordConversionModal>;
    return <div className="modal-page-wrap record-conversion"><div className="modal-card modal-card-wide modal-page-card">
        <div className="toolbar-card modal-toolbar-card">
            <div><h2>Converti incasso #{props.id}</h2><p className="muted">Tipo attuale: {typeLabel(props.sourceType)}</p></div>
            <Link className="btn btn-sm btn-default" href={props.returnHref}>Annulla</Link>
        </div>
        {content}
    </div></div>;
}

function CashConversionForm({formProps, onSubmit}: {formProps: IncomeProps; onSubmit: (data: FormData) => void}) {
    const source = formProps.initialIncome!;
    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
    }
    return <form className="card form app-record-form" data-in-place-submit="true" onSubmit={handleSubmit}>
        <p className="field-note full">Lo scontrino richiede un unico accredito per l’intero importo, con metodo e conto compatibili con la cassa. Data e importo sono conservati dall’accredito; il cliente diventa quello generico della cassa.</p>
        <label>Importo<input name="amount" readOnly value={String(source.amount ?? '')}/></label>
        <label>Data accredito<input readOnly value={source.credits?.[0]?.creditDate ? new Date(source.credits[0].creditDate).toLocaleDateString('it-IT') : 'Nessun accredito registrato'}/></label>
        <label>Canale di vendita<select name="salesChannelId" defaultValue={source.salesChannelId} required>{formProps.salesChannels.map(channel => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label>
        <label>Tipo<select name="isFiscal" defaultValue={String(source.isFiscal ?? true)}><option value="true">Fiscale</option><option value="false">Non fiscale</option></select></label>
        <label>IVA<select name="vatRate" defaultValue={[0,4,10,22].includes(Number(source.vatRate)) ? String(Number(source.vatRate)) : '22'}>{[0,4,10,22].map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
        <label className="full">Descrizione<input name="description" defaultValue={source.description ?? ''} maxLength={200}/></label>
        <label className="full">Note<textarea name="notes" defaultValue={source.notes ?? ''}/></label>
        <div className="form-actions full"><button className="btn btn-md btn-primary" type="submit">Verifica conversione</button></div>
    </form>;
}
