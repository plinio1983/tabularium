"use client";

import {type ReactNode, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {DateField} from '@/components/FormControls';

type Option = {id: number; name: string; icon?: string | null};
type Step = '' | 'categoryId' | 'schedule' | 'payment';
const groups = [
  {name: 'categoryId', label: 'Categoria', hint: 'Assegna una categoria comune', icon: '🏷'},
  {name: 'schedule', label: 'Cadenza e fatturazione', hint: 'Cadenza, data inizio e periodo fatturazione', icon: '↻'},
  {name: 'payment', label: 'Pagamento', hint: 'Modalità e giorno pagamento', icon: '€'},
] as const;
const cadences = [['MONTHLY', 'Ogni mese'], ['EVERY_2_MONTHS', 'Ogni 2 mesi'], ['EVERY_3_MONTHS', 'Ogni 3 mesi'], ['EVERY_6_MONTHS', 'Ogni 6 mesi'], ['YEARLY', 'Annuale'], ['EVERY_2_YEARS', 'Ogni 2 anni']];
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function EditableField({title, hint, name, active, onChange, children}: {
  title: string; hint: string; name: string; active: boolean; onChange: (active: boolean) => void; children: ReactNode;
}) {
  return <section className={`bulk-edit-date-card bulk-edit-accounting-card${active ? ' is-active' : ''}`}>
    <div className="bulk-edit-date-card-heading">
      <div><strong>{title}</strong><small>{hint}</small></div>
      <div className="switch-toggle-field switch-clean switch-inline"><label className="switch" aria-label={`Modifica ${title}`}>
        <input type="checkbox" name={name} checked={active} onChange={event => onChange(event.currentTarget.checked)}/><span className="slider"/>
      </label></div>
    </div>
    {active ? <div className="bulk-edit-accounting-control">{children}</div> : null}
  </section>;
}

export default function RecurringExpenseBulkEditModal({formId, action, categories, methods, banks}: {
  formId: string; action: string; categories: Option[]; methods: Option[]; banks: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const value = (name: string) => values[name] || '';
  const change = (name: string, next: string) => setValues(previous => ({...previous, [name]: next}));
  const toggle = (name: string, next: boolean) => setActive(previous => ({...previous, [name]: next}));
  const close = () => {setOpen(false); setStep('');};

  useEffect(() => {
    const onRequest = (event: Event) => {
      if ((event as CustomEvent).detail?.formId !== formId) return;
      const selected = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`)).map(input => input.value);
      if (!selected.length) return;
      setIds(selected); setStep(''); setDirection('forward'); setActive({}); setValues({}); setOpen(true);
    };
    document.addEventListener('bulk-edit-request', onRequest);
    return () => document.removeEventListener('bulk-edit-request', onRequest);
  }, [formId]);

  const choose = (next: Step) => {setStep(next); setDirection('forward');};
  const back = () => {setStep(''); setDirection('back');};
  const optionSelect = (name: string, label: string, options: Option[]) => <label><span>{label}</span>
    <select name={name} required value={value(name)} onChange={event => change(name, event.target.value)}>
      <option value="">Seleziona {label.toLowerCase()}</option>{options.map(option => <option key={option.id} value={option.id}>{option.icon ? `${option.icon} ${option.name}` : option.name}</option>)}
    </select>
  </label>;
  const enabledFields = step === 'schedule' ? ['updateCadence', 'updateStartDate', 'updateBilling'] : ['updatePayment', 'updateDueDay'];
  const incomplete = step === 'categoryId' ? !value('categoryId') : !enabledFields.some(name => active[name])
    || (step === 'schedule' && ((active.updateCadence && !value('cadence')) || (active.updateStartDate && !value('startDate'))
      || (active.updateBilling && (!value('billingPeriodMode') || (value('billingPeriodMode') === 'CUSTOM_MONTH' && !value('billingMonth'))))))
    || (step === 'payment' && ((active.updateDueDay && (!value('dueDay') || !Number.isInteger(Number(value('dueDay'))) || Number(value('dueDay')) < 1 || Number(value('dueDay')) > 30))
      || (active.updatePayment && (!value('isAutomaticPayment') || (value('isAutomaticPayment') === 'true' && (!value('paymentMethodId') || !value('bankId')))))));

  if (!open) return null;
  return createPortal(<div className="app-form-modal-backdrop bulk-category-modal-backdrop" role="presentation" onMouseDown={event => {if (event.target === event.currentTarget) close();}}>
    <div className="bulk-category-modal bulk-edit-fields-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-bulk-edit-title`}>
      <div className="modal-toolbar-card toolbar-card">
        <div className="bulk-edit-toolbar-copy"><span className="bulk-edit-toolbar-kicker">Modifica multipla</span>
          <h2 id={`${formId}-bulk-edit-title`}>{step ? groups.find(group => group.name === step)?.label : 'Modifica uscite ricorrenti'}</h2>
          <p className="muted"><strong>{ids.length}</strong> record selezionati</p>
        </div>
        <button type="button" className="bulk-edit-close-button" aria-label="Chiudi modifica multipla" onClick={close}>✕</button>
      </div>
      <div key={step} className={`bulk-edit-step bulk-edit-step-${direction}`}>
        {!step ? <div className="bulk-edit-form bulk-edit-choice-form">
          <div className="bulk-edit-choice-intro"><strong>Cosa vuoi modificare?</strong><span>Scegli un gruppo di informazioni. I campi non selezionati resteranno invariati.</span></div>
          <div className="bulk-edit-fields-list">{groups.map(group => <button type="button" className="bulk-edit-field-button" key={group.name} onClick={() => choose(group.name)}>
            <span className="bulk-edit-field-icon" aria-hidden="true">{group.icon}</span><span className="bulk-edit-field-copy"><strong>{group.label}</strong><small>{group.hint}</small></span><span className="bulk-edit-field-status">›</span>
          </button>)}</div>
          <div className="bulk-edit-actions"><button type="button" className="btn btn-md btn-default" onClick={close}>Annulla</button></div>
        </div> : <form action={action} method="post" className={`bulk-edit-form ${step === 'categoryId' ? 'bulk-edit-category-form' : 'bulk-edit-accounting-form'}`}>
          <input type="hidden" name="bulkAction" value="bulk_edit"/><input type="hidden" name="field" value={step}/>
          {ids.map(id => <input type="hidden" name="ids" value={id} key={id}/>)}
          <div className={step === 'categoryId' ? 'bulk-edit-category-content' : 'bulk-edit-accounting-content'}>
            {step === 'categoryId' ? optionSelect('categoryId', 'Categoria', categories) : null}
            {step === 'schedule' ? <>
              <EditableField title="Cadenza" hint="Imposta la frequenza delle ricorrenze selezionate" name="updateCadence" active={!!active.updateCadence} onChange={next => toggle('updateCadence', next)}>
                <label><span>Nuova cadenza</span><select name="cadence" required value={value('cadence')} onChange={event => change('cadence', event.target.value)}>
                  <option value="">Seleziona cadenza</option>{cadences.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select></label>
              </EditableField>
              <EditableField title="Data inizio" hint="Assegna la stessa data inizio alle ricorrenze selezionate" name="updateStartDate" active={!!active.updateStartDate} onChange={next => toggle('updateStartDate', next)}>
                <div className="app-form-wizard bulk-edit-date-control-scope"><DateField label="Nuova data inizio" name="startDate" value={value('startDate')} onChange={next => change('startDate', next)} required/></div>
              </EditableField>
              <EditableField title="Periodo fatturazione" hint="Imposta il periodo di fatturazione delle ricorrenze selezionate" name="updateBilling" active={!!active.updateBilling} onChange={next => toggle('updateBilling', next)}>
                <label><span>Nuovo periodo fatturazione</span><select name="billingPeriodMode" required value={value('billingPeriodMode')} onChange={event => change('billingPeriodMode', event.target.value)}>
                  <option value="">Seleziona periodo</option><option value="SAME_MONTH">Stesso mese</option><option value="NEXT_MONTH">Mese successivo</option><option value="CUSTOM_MONTH">Mese impostato</option>
                </select></label>
                {value('billingPeriodMode') === 'CUSTOM_MONTH' ? <label><span>Mese fatturazione</span><select name="billingMonth" required value={value('billingMonth')} onChange={event => change('billingMonth', event.target.value)}>
                  <option value="">Seleziona mese</option>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </select></label> : null}
              </EditableField>
            </> : null}
            {step === 'payment' ? <>
              <EditableField title="Modalità pagamento" hint="Scegli pagamento manuale o automatico" name="updatePayment" active={!!active.updatePayment} onChange={next => toggle('updatePayment', next)}>
                <label><span>Nuova modalità pagamento</span><select name="isAutomaticPayment" required value={value('isAutomaticPayment')} onChange={event => change('isAutomaticPayment', event.target.value)}>
                  <option value="">Seleziona modalità</option><option value="false">✋ Manuale</option><option value="true">⚙️ Automatico</option>
                </select></label>
                {value('isAutomaticPayment') === 'true' ? <>{optionSelect('paymentMethodId', 'Metodo', methods)}{optionSelect('bankId', 'Banca', banks)}</> : null}
              </EditableField>
              <EditableField title="Giorno pagamento" hint="Assegna un giorno del mese da 1 a 30" name="updateDueDay" active={!!active.updateDueDay} onChange={next => toggle('updateDueDay', next)}>
                <label><span>Nuovo giorno pagamento</span><select name="dueDay" required value={value('dueDay')} onChange={event => change('dueDay', event.target.value)}>
                  <option value="">Seleziona giorno</option>{Array.from({length: 30}, (_, index) => index + 1).map(day => <option key={day} value={day}>{day}</option>)}
                </select></label>
              </EditableField>
            </> : null}
            {step !== 'categoryId' && !enabledFields.some(name => active[name]) ? <p className="muted bulk-edit-dates-hint">Attiva almeno un campo da modificare.</p> : null}
          </div>
          <div className="bulk-edit-actions"><button type="button" className="btn btn-md btn-default" onClick={back}>‹ Indietro</button><button type="submit" className="btn btn-md btn-primary" disabled={!!incomplete}>✓ Conferma</button></div>
        </form>}
      </div>
    </div>
  </div>, document.body);
}
