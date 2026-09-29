'use client';

import {useRef, useState, type ComponentProps, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import ExpenseForm from '@/components/ExpenseForm';
import IncomeForm from '@/components/IncomeForm';
import {conversionLabels, expenseConversionDefaults, expenseConversionTypes, type ExpenseConversionType} from '@/lib/record-conversion';

type ExpenseProps = ComponentProps<typeof ExpenseForm>;
type IncomeProps = ComponentProps<typeof IncomeForm>;
type Props = {id: number; snapshot: string; returnHref: string} & (
    {kind: 'expenses'; sourceType: ExpenseConversionType; formProps: ExpenseProps} |
    {kind: 'incomes'; sourceType: 'STANDARD' | 'CASH_REGISTER'; formProps: IncomeProps}
);
type Review = {reviewToken: string; changes: Array<{label: string; before: string; after: string}>};

export default function RecordConversionForm(props: Props) {
    const router = useRouter();
    const typeLabel = (type: string) => type === 'STANDARD' ? props.kind === 'expenses' ? 'Spesa singola' : 'Incasso singolo' : conversionLabels[type];
    const targets = props.kind === 'expenses' ? expenseConversionTypes : ['STANDARD', 'CASH_REGISTER'];
    const [target, setTarget] = useState('');
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
                router.push(props.returnHref);
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

    const preserved = 'Pagamenti, accrediti e allegati rimangono collegati allo stesso record. Per modificarli usa le rispettive funzioni dopo la conversione.';
    return <div className="modal-page-wrap record-conversion">
        <div className="modal-card modal-card-wide modal-page-card">
            <div className="toolbar-card modal-toolbar-card">
                <div><h2>Converti {props.kind === 'expenses' ? 'spesa' : 'incasso'} #{props.id}</h2><p className="muted">Tipo attuale: {typeLabel(props.sourceType)}</p></div>
                <Link className="btn btn-sm btn-default" href={props.returnHref}>Annulla</Link>
            </div>
            <p className="field-note">{preserved}</p>
            {error ? <p className="text-critical" role="alert" tabIndex={-1} ref={errorMessage}>{error}</p> : null}
            <div hidden={Boolean(review)}>
                <label className="full">Converti in
                    <select value={target} disabled={busy} onChange={event => {setTarget(event.target.value); setError('');}}>
                        <option value="">Seleziona il nuovo tipo</option>
                        {targets.filter(type => type !== props.sourceType).map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
                    </select>
                </label>
                {target ? <fieldset disabled={busy} style={{border: 0, padding: 0, margin: 0, minWidth: 0}}>
                    {props.kind === 'expenses' ? <>
                        {target === 'PAYROLL' ? <p className="field-note">L’importo originale è proposto come netto. Completa dipendente e periodo lavorato; verifica gli eventuali compensi extra.</p> : null}
                        <ExpenseForm key={target} {...props.formProps}
                            initialExpense={expenseConversionDefaults(props.formProps.initialExpense!, target as ExpenseConversionType)}
                            action={`/api/${props.kind}/${props.id}/convert`} preserveLinkedRecords hideMobileActions={Boolean(review) || busy} onSubmitData={data => void submit(data)} submitLabel="Verifica conversione" cancelHref={props.returnHref}/>
                    </> : target === 'STANDARD' ? <IncomeForm key={target} {...props.formProps}
                        initialIncome={{...props.formProps.initialIncome, customerId: null}}
                        action={`/api/${props.kind}/${props.id}/convert`} preserveLinkedRecords hideMobileActions={Boolean(review) || busy} onSubmitData={data => void submit(data)} submitLabel="Verifica conversione" cancelHref={props.returnHref}/>
                        : <CashConversionForm formProps={props.formProps} onSubmit={data => void submit(data)}/>}
                </fieldset> : null}
            </div>
            {review ? <section className="card">
                <h3 tabIndex={-1} ref={reviewHeading}>Conferma conversione in {typeLabel(target)}</h3>
                <p>Verifica i dati che cambieranno. I campi specifici del tipo precedente saranno rimossi; gli allegati conserveranno la classificazione attuale.</p>
                <dl>{review.changes.map(change => <div key={change.label} className="conversion-change"><dt>{change.label}</dt><dd>{change.before} → <strong>{change.after}</strong></dd></div>)}</dl>
                <div className="form-actions">
                    <button type="button" className="btn btn-md btn-default" disabled={busy} onClick={() => setReview(null)}>Torna al form</button>
                    <button type="button" className="btn btn-md btn-primary" disabled={busy} onClick={() => pending.current && void submit(pending.current, true)}>{busy ? 'Conversione…' : 'Conferma conversione'}</button>
                </div>
            </section> : null}
        </div>
    </div>;
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
