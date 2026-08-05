"use client";

import {useEffect, useState} from "react";
import {createPortal} from "react-dom";

function selectedIdsForForm(formId: string) {
  return [...new Set(Array.from(document.querySelectorAll<HTMLInputElement>(
    `input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`,
  )).map(input => input.value))];
}

export default function BulkCopyIncomesModal({formId, action}: {formId: string; action: string}) {
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
    document.addEventListener("income-bulk-copy-request", open);
    return () => document.removeEventListener("income-bulk-copy-request", open);
  }, [formId]);

  if (!isOpen) return null;
  return createPortal(<div className="app-form-modal-backdrop bulk-category-modal-backdrop bulk-copy-expenses-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) setIsOpen(false);
  }}>
    <div className="app-form-modal bulk-category-modal bulk-copy-expenses-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-copy-modal-title`}>
      <div className="modal-toolbar-card toolbar-card"><div><h2 id={`${formId}-copy-modal-title`}>Copia incassi</h2><p className="muted">Incassi selezionati: <strong>{selectedIds.length}</strong></p></div><button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setIsOpen(false)}>×</button></div>
      <form action={action} method="post" className="form bulk-category-modal-form bulk-copy-expenses-form">
        <input type="hidden" name="bulkAction" value="copy"/>{selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id}/>)}
        <fieldset><legend>Data ordine e scadenza</legend>
          <label className="bulk-copy-option"><input type="radio" name="dateMode" value="ORIGINAL"/><span><strong>Mantieni date originali</strong><small>Le copie conservano data ordine, scadenza e periodo contabile.</small></span></label>
          <label className="bulk-copy-option"><input type="radio" name="dateMode" value="CURRENT_MONTH_SAME_DAY" defaultChecked/><span><strong>Ricalcola mantenendo il giorno del mese</strong><small>Sposta date e periodo contabile sul periodo corrente.</small></span></label>
          <label className="bulk-copy-option"><input type="radio" name="dateMode" value="FROM_TODAY"/><span><strong>Ricalcola da oggi</strong><small>Imposta l’ordine a oggi e conserva la distanza dalla scadenza.</small></span></label>
        </fieldset>
        <fieldset><legend>Accrediti</legend>
          <label className="bulk-copy-option"><input type="radio" name="creditMode" value="NONE" defaultChecked/><span><strong>Non copiare gli accrediti</strong><small>I nuovi incassi risulteranno da accreditare.</small></span></label>
          <label className="bulk-copy-option"><input type="radio" name="creditMode" value="ORIGINAL"/><span><strong>Copia accrediti e date</strong><small>Mantiene le date di accredito originali.</small></span></label>
          <label className="bulk-copy-option"><input type="radio" name="creditMode" value="TODAY"/><span><strong>Copia accrediti con data odierna</strong><small>Sostituisce tutte le date di accredito con oggi.</small></span></label>
          <label className="bulk-copy-option"><input type="radio" name="creditMode" value="RELATIVE_TO_ORDER"/><span><strong>Ricalcola dalla data ordine</strong><small>Mantiene per ogni accredito la distanza dall’ordine originale.</small></span></label>
        </fieldset>
        <div className="actions-row form-actions-row"><button type="button" className="btn btn-sm btn-default" onClick={() => setIsOpen(false)}>× Annulla</button><button type="submit" className="btn btn-md btn-primary">⧉ Copia incassi</button></div>
      </form>
    </div>
  </div>, document.body);
}
