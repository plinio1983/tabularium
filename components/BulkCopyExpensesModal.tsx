"use client";

import {useEffect, useState} from "react";
import {createPortal} from "react-dom";

function selectedIdsForForm(formId: string) {
    const values = Array.from(document.querySelectorAll<HTMLInputElement>(
        `input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`,
    )).map(input => input.value);
    return [...new Set(values)];
}

export default function BulkCopyExpensesModal({formId, action}: {formId: string; action: string}) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const open = (event: Event) => {
            const detail = (event as CustomEvent<{formId?: string}>).detail;
            if (detail?.formId !== formId) return;
            const ids = selectedIdsForForm(formId);
            if (ids.length < 2) return;
            setSelectedIds(ids);
            setIsOpen(true);
        };
        document.addEventListener("expense-bulk-copy-request", open);
        return () => document.removeEventListener("expense-bulk-copy-request", open);
    }, [formId]);

    if (!isOpen) return null;

    return createPortal(
        <div className="app-form-modal-backdrop bulk-category-modal-backdrop bulk-copy-expenses-backdrop" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setIsOpen(false);
        }}>
            <div className="app-form-modal bulk-category-modal bulk-copy-expenses-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-copy-modal-title`}>
                <div className="modal-toolbar-card toolbar-card">
                    <div>
                        <h2 id={`${formId}-copy-modal-title`}>Copia spese</h2>
                        <p className="muted">Spese selezionate: <strong>{selectedIds.length}</strong></p>
                    </div>
                    <button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setIsOpen(false)}>×</button>
                </div>
                <form action={action} method="post" className="form bulk-category-modal-form bulk-copy-expenses-form">
                    <input type="hidden" name="bulkAction" value="copy"/>
                    {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id}/>)}

                    <fieldset>
                        <legend>Data ordine e scadenza</legend>
                        <label className="bulk-copy-option">
                            <input type="radio" name="dateMode" value="ORIGINAL"/>
                            <span><strong>Mantieni date originali</strong><small>Le copie conservano data ordine e scadenza.</small></span>
                        </label>
                        <label className="bulk-copy-option">
                            <input type="radio" name="dateMode" value="CURRENT_MONTH_SAME_DAY" defaultChecked/>
                            <span><strong>Ricalcola mantenendo il giorno del mese</strong><small>Sposta le date sul periodo corrente conservando i rispettivi giorni.</small></span>
                        </label>
                        <label className="bulk-copy-option">
                            <input type="radio" name="dateMode" value="FROM_TODAY"/>
                            <span><strong>Ricalcola da oggi</strong><small>Imposta l’ordine a oggi e conserva la distanza dalla scadenza.</small></span>
                        </label>
                    </fieldset>

                    <fieldset>
                        <legend>Pagamenti</legend>
                        <label className="bulk-copy-option">
                            <input type="radio" name="paymentMode" value="NONE" defaultChecked/>
                            <span><strong>Non copiare i pagamenti</strong><small>Le nuove spese risulteranno da pagare.</small></span>
                        </label>
                        <label className="bulk-copy-option">
                            <input type="radio" name="paymentMode" value="ORIGINAL"/>
                            <span><strong>Copia pagamenti e date</strong><small>Mantiene le date di pagamento originali.</small></span>
                        </label>
                        <label className="bulk-copy-option">
                            <input type="radio" name="paymentMode" value="TODAY"/>
                            <span><strong>Copia pagamenti con data odierna</strong><small>Sostituisce tutte le date di pagamento con oggi.</small></span>
                        </label>
                        <label className="bulk-copy-option">
                            <input type="radio" name="paymentMode" value="RELATIVE_TO_ORDER"/>
                            <span><strong>Ricalcola dalla data ordine</strong><small>Mantiene per ogni pagamento la distanza temporale dall’ordine originale.</small></span>
                        </label>
                    </fieldset>

                    <div className="actions-row form-actions-row">
                        <button type="button" className="btn btn-sm btn-default" onClick={() => setIsOpen(false)}>× Annulla</button>
                        <button type="submit" className="btn btn-md btn-primary">⧉ Copia spese</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
