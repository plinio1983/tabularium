'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

type Action = (formData: FormData) => void | Promise<void>;

function EditSurface({heading, title, onClose, children}: {
    heading: string;
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', closeOnEscape);
        document.body.classList.add('payment-credit-edit-modal-open');
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.body.classList.remove('payment-credit-edit-modal-open');
        };
    }, [onClose]);

    return createPortal(
        <div className="app-form-modal-backdrop payment-credit-edit-modal-backdrop" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <div className="app-form-modal settings-form-modal payment-credit-edit-modal" role="dialog" aria-modal="true" aria-labelledby="payment-credit-edit-modal-title">
                <div className="modal-toolbar-card toolbar-card">
                    <div>
                        <h2 id="payment-credit-edit-modal-title">{heading}</h2>
                        <p className="muted">{title}</p>
                    </div>
                    <button type="button" className="btn btn-icon-only btn-default modal-close-button" aria-label="Chiudi" onClick={onClose}>×</button>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}

type Props = {
    id: number;
    name: string;
    icon: string | null;
    kind?: string;
    kindLabel: string;
    usageCount: number;
    protectedFromDelete: boolean;
    isExpenseDefault?: boolean;
    isIncomeDefault?: boolean;
    primary?: boolean;
    canBePrimary?: boolean;
    iconOptions: readonly string[];
    updateAction: Action;
    deleteAction: Action;
    cashRegister?: {
        enabled: boolean;
        defaultBankId: number | null;
        primary: boolean;
        cash: boolean;
        banks: Array<{ id: number; name: string; icon: string | null; isPrimary?: boolean }>;
    };
};

export default function PaymentCreditEditRow({
                                                 id,
                                                 name,
                                                 icon,
                                                 kind,
                                                 kindLabel,
                                                 usageCount,
                                                 protectedFromDelete,
                                                 isExpenseDefault = false,
                                                 isIncomeDefault = false,
                                                 primary = false,
                                                 canBePrimary = true,
                                                 iconOptions,
                                                 updateAction,
                                                 deleteAction,
                                                 cashRegister
                                             }: Props) {
    const [editing, setEditing] = useState(false);
    const [cashRegisterEnabled, setCashRegisterEnabled] = useState(cashRegister?.enabled ?? false);
    const [cashRegisterPrimary, setCashRegisterPrimary] = useState(cashRegister?.primary ?? false);

    function setRegisterAvailability(enabled: boolean) {
        setCashRegisterEnabled(enabled);
        if (!enabled) setCashRegisterPrimary(false);
    }

    return <div className={`payment-credit-row-shell ${kind ? 'payment-credit-method-row-shell' : 'payment-credit-bank-row-shell'}`}>
        <div className={`payment-credit-display-row settings-entity-item ${kind ? 'payment-credit-method-display-row' : 'payment-credit-bank-display-row'}`}>
            <div className="payment-credit-display-name-wrap settings-entity-copy">
                <strong className="payment-credit-display-name">
                    {name}&nbsp;&nbsp;
                    {protectedFromDelete ? <span className="badge tone-neutral">Sistema</span> : null}
                </strong>
                {kind ? <div className="payment-credit-method-meta">
                    <span>{kindLabel}</span>
                    <span><strong>{usageCount}</strong> {usageCount === 1 ? 'movimento' : 'movimenti'}</span>
                    {isExpenseDefault ? <span className="badge">Predefinito spese</span> : null}
                    {isIncomeDefault ? <span className="badge">Predefinito incassi</span> : null}
                    {/*{protectedFromDelete ? <span className="badge tone-neutral">Sistema</span> : null}*/}
                </div> : null}
                {!kind ? <div className="payment-credit-bank-meta">
                    <span>{kindLabel}</span>
                    <span><strong>{usageCount}</strong> {usageCount === 1 ? 'movimento' : 'movimenti'}</span>
                    {primary ? <span className="badge">Principale</span> : null}
                </div> : null}
            </div>
            <span className="payment-credit-display-icon settings-entity-icon" aria-label={icon ? `Icona ${icon}` : 'Nessuna icona'}>{icon ?? '  •  '}</span>
            {kind ? null : <form action={updateAction} className="payment-credit-primary-switch-form switch-toggle-field switch-clean switch-inline">
                <input type="hidden" name="id" value={id}/>
                <input type="hidden" name="name" value={name}/>
                <input type="hidden" name="icon" value={icon ?? ''}/>
                <span className="payment-credit-mobile-field-label">Principale</span>
                <label className="switch" aria-label={`Imposta ${name} come banca principale`}>
                    <input
                        type="checkbox"
                        name="primary"
                        defaultChecked={primary}
                        disabled={!canBePrimary}
                        onChange={event => event.currentTarget.form?.requestSubmit()}
                    />
                    <span className="slider"/>
                </label>
            </form>}
            <span className="payment-credit-display-usage"><strong>{usageCount}</strong> {usageCount === 1 ? '' : ''}</span>
            <div className="payment-credit-display-actions settings-entity-actions">
                {protectedFromDelete
                    ? null
                    : <form action={deleteAction}>
                        <input type="hidden" name="id" value={id}/>
                        <button type="submit" className="btn btn-sm btn-danger">Rimuovi</button>
                    </form>}
                <button type="button" className="btn btn-sm btn-primary" aria-expanded={editing} onClick={() => setEditing(value => !value)}>
                    ✎ {editing ? 'Chiudi' : 'Modifica'}
                </button>
            </div>
        </div>

        {editing ? <EditSurface heading={kind ? 'Modifica metodo di pagamento' : 'Modifica banca o canale'} title={name} onClose={() => setEditing(false)}>
          <form action={updateAction} className="form app-record-form payment-credit-expanded-form payment-credit-modal-form">
            <input type="hidden" name="id" value={id}/>
            {cashRegister ? <input type="hidden" name="cashRegisterManaged" value="1"/> : null}
            <label><span>Label</span><input name="name" defaultValue={name} maxLength={80} required/></label>
            <label><span>Icona</span><select name="icon" defaultValue={icon ?? ''}>
                <option value="">Nessuna</option>
                {iconOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select></label>
            {!kind ? <div className="payment-credit-primary-field switch-toggle-field">
                <span>Principale</span>
                <label className="switch" aria-label={`Imposta ${name} come banca principale`}>
                    <input type="checkbox" name="primary" defaultChecked={primary} disabled={!canBePrimary}/>
                    <span className="slider"/>
                </label>
            </div> : null}
            {kind ? <label><span>Uso</span><select name="kind" defaultValue={kind}>
                <option value="BOTH">Entrambi</option>
                <option value="INCOME">Incassi</option>
                <option value="EXPENSE">Spese</option>
            </select></label> : null}
          {kind ? <fieldset className="payment-credit-default-fields">
                <legend>Predefinito nei form</legend>
                <div className="payment-credit-default-switch-row switch-toggle-field switch-inline wide">
                    <div><strong>Spese</strong><span>Preseleziona questo metodo nei nuovi pagamenti.</span></div>
                    <label className="switch" aria-label="Metodo predefinito per le spese">
                        <input type="checkbox" name="isExpenseDefault" defaultChecked={isExpenseDefault}/>
                        <span className="slider"/>
                    </label>
                </div>
                <div className="payment-credit-default-switch-row switch-toggle-field switch-inline wide">
                    <div><strong>Incassi</strong><span>Preseleziona questo metodo nei nuovi accrediti.</span></div>
                    <label className="switch" aria-label="Metodo predefinito per gli incassi">
                        <input type="checkbox" name="isIncomeDefault" defaultChecked={isIncomeDefault}/>
                        <span className="slider"/>
                    </label>
                </div>
            </fieldset> : null}
            {cashRegister ? <fieldset className="payment-credit-cash-register-fields">
                <legend>Uso nel registratore di cassa</legend>
                <div className="cash-register-setting-intro">
                    <small>{cashRegister.cash ? 'Pagamento Cash' : 'Disponibilità del metodo'}</small>
                    <span>{cashRegister.cash
                        ? 'Questo metodo è sempre associato al canale di accredito Cassa.'
                        : 'Decidi se questo metodo può essere scelto durante una vendita da banco.'}</span>
                </div>
                <div className="cash-register-setting-row switch-toggle-field switch-inline wide">
                    <div>
                        <strong>Disponibile nel registratore</strong>
                        <span>{cashRegisterEnabled ? 'Il metodo compare tra le opzioni di pagamento.' : 'Il metodo non compare nel registratore.'}</span>
                    </div>
                    <label className="switch" aria-label="Disponibile nel registratore">
                        {/*<span>{cashRegisterEnabled ? 'Attivo' : 'Non attivo'}</span>*/}
                        <input type="checkbox" name="cashRegisterEnabled" checked={cashRegisterEnabled}
                               onChange={event => setRegisterAvailability(event.currentTarget.checked)}/>
                        <span className="slider"/>
                    </label>
                </div>
                {cashRegisterEnabled && !cashRegister.cash ? <>
                    <label className="cash-register-bank-setting">
                        <span>Banca di accredito automatica</span>
                        <small>Verrà assegnata senza richiederla durante la registrazione.</small>
                        <select name="cashRegisterDefaultBankId" defaultValue={cashRegister.defaultBankId ?? cashRegister.banks.find(bank => bank.isPrimary)?.id ?? ''} required>
                            <option value="">Seleziona banca</option>
                            {cashRegister.banks.map(bank =>
                                <option value={bank.id} key={bank.id}>{bank.icon ?? ''} {bank.name}</option>)}
                        </select>
                    </label>
                    <div className="cash-register-setting-row switch-toggle-field switch-inline wide">
                        <div>
                            <strong>Pagamento rapido</strong>
                            <span>Mostra questo metodo come pulsante diretto insieme a Cash.</span>
                        </div>
                        <label className="switch" aria-label="Mostra come pagamento rapido">
                            <small>{cashRegisterPrimary ? 'Visibile' : 'Nel menu'}</small>
                            <input type="checkbox" name="cashRegisterPrimary" checked={cashRegisterPrimary}
                                   onChange={event => setCashRegisterPrimary(event.currentTarget.checked)}/>
                            <span className="slider"/>
                        </label>
                    </div>
                </> : null}
                {cashRegisterEnabled && cashRegister.cash
                    ?
                    <div className="cash-register-fixed-channel"><span>Canale automatico</span><strong>💶 Cassa</strong>
                    </div>
                    : null}
            </fieldset> : null}
            <div className="payment-credit-expanded-actions">
                <button type="button" className="btn btn-sm btn-default" onClick={() => setEditing(false)}>Annulla</button>
                <button type="submit" className="btn btn-sm btn-primary">✓ Salva modifiche</button>
            </div>
          </form>
        </EditSurface> : null}
    </div>;
}
