"use client";

import {useEffect, useState} from "react";
import {createPortal} from "react-dom";

type Props = {
  formId: string;
  subject: "spese" | "incassi";
};

const fields = [
  {label: "Data ordine e scadenza", icon: "📅", enabled: false},
  {label: "Categoria", icon: "🏷", enabled: true},
  {label: "Esercente", icon: "🏪", enabled: false},
  {label: "Informazioni fiscali e contabili", icon: "🧾", enabled: false},
] as const;

export default function BulkEditFieldsModal({formId, subject}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<{formId?: string; selectedCount?: number}>).detail;
      if (detail?.formId !== formId) return;
      setSelectedCount(detail.selectedCount ?? 0);
      setIsOpen(true);
    };
    document.addEventListener("bulk-edit-request", onRequest);
    return () => document.removeEventListener("bulk-edit-request", onRequest);
  }, [formId]);

  function selectCategory() {
    setIsOpen(false);
    document.dispatchEvent(new CustomEvent("bulk-change-category-request", {detail: {formId}}));
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="app-form-modal-backdrop bulk-category-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setIsOpen(false);
    }}>
      <div className="app-form-modal bulk-category-modal bulk-edit-fields-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-bulk-edit-title`}>
        <div className="modal-toolbar-card toolbar-card">
          <div>
            <h2 id={`${formId}-bulk-edit-title`}>Modifica {subject}</h2>
            <p className="muted">Record selezionati: <strong>{selectedCount}</strong></p>
          </div>
        </div>
        <div className="bulk-edit-fields-list">
          {fields.map(field => <button
            key={field.label}
            type="button"
            className={`bulk-edit-field-button${field.enabled ? "" : " is-disabled"}`}
            disabled={!field.enabled}
            onClick={field.enabled ? selectCategory : undefined}
          >
            <span className="bulk-edit-field-icon" aria-hidden="true">{field.icon}</span>
            <span>{field.label}</span>
            <span className="bulk-edit-field-status">{field.enabled ? "›" : "Prossimamente"}</span>
          </button>)}
          <div className="bulk-edit-accounting-fields muted">
            Fiscale, aliquota IVA, periodo contabile, fattura elettronica e stato fattura
          </div>
        </div>
        <div className="actions-row form-actions-row">
          <button type="button" className="btn btn-sm btn-default" onClick={() => setIsOpen(false)}>× Annulla</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
