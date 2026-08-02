"use client";

import {useEffect, useState} from "react";
import {createPortal} from "react-dom";

type Props = {
  formId: string;
  subject: "spese" | "incassi";
  action?: string;
  categoryFieldName?: string;
  categories?: Array<{value: string; label: string; icon?: string | null}>;
};

type Step = "choice" | "category";

function selectedIdsForForm(formId: string) {
  return Array.from(document.querySelectorAll<HTMLInputElement>(
    `input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`,
  )).map(input => input.value);
}

export default function BulkEditFieldsModal({formId, subject, action, categoryFieldName = "categoryId", categories = []}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("choice");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const hasCategoryStep = Boolean(action && categories.length);
  const fields = [
    {label: "Data ordine e scadenza", icon: "📅", enabled: false},
    {label: "Categoria", icon: "🏷", enabled: hasCategoryStep, step: "category" as const},
    {label: "Esercente", icon: "🏪", enabled: false},
    {label: "Informazioni fiscali e contabili", icon: "🧾", enabled: false},
  ];

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<{formId?: string; selectedCount?: number}>).detail;
      if (detail?.formId !== formId) return;
      const ids = selectedIdsForForm(formId);
      if (!ids.length) return;
      setSelectedIds(ids);
      setStep("choice");
      setDirection("forward");
      setIsOpen(true);
    };
    document.addEventListener("bulk-edit-request", onRequest);
    return () => document.removeEventListener("bulk-edit-request", onRequest);
  }, [formId]);

  function closeModal() {
    setIsOpen(false);
    setStep("choice");
  }

  function selectCategory() {
    setDirection("forward");
    setStep("category");
  }

  function goBack() {
    setDirection("back");
    setStep("choice");
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="app-form-modal-backdrop bulk-category-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) closeModal();
    }}>
      <div className="app-form-modal bulk-category-modal bulk-edit-fields-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-bulk-edit-title`}>
        <div className="modal-toolbar-card toolbar-card">
          <div>
            <h2 id={`${formId}-bulk-edit-title`}>{step === "choice" ? `Modifica ${subject}` : "Modifica categoria"}</h2>
            <p className="muted">Record selezionati: <strong>{selectedIds.length}</strong></p>
          </div>
        </div>
        <div key={step} className={`bulk-edit-step bulk-edit-step-${direction}`}>
          {step === "choice" ? <>
            <div className="bulk-edit-fields-list">
              {fields.map(field => <button
                key={field.label}
                type="button"
                className={`bulk-edit-field-button${field.enabled ? "" : " is-disabled"}`}
                disabled={!field.enabled}
                onClick={field.step === "category" && field.enabled ? selectCategory : undefined}
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
              <button type="button" className="btn btn-sm btn-default" onClick={closeModal}>× Annulla</button>
            </div>
          </> : <form action={action} method="post" className="form bulk-category-modal-form">
            <input type="hidden" name="bulkAction" value="change_category" />
            {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
            <label>Categoria
              <select name={categoryFieldName} required defaultValue="">
                <option value="" disabled>Seleziona categoria</option>
                {categories.map(category => <option key={category.value} value={category.value}>
                  {category.icon ? `${category.icon} ${category.label}` : category.label}
                </option>)}
              </select>
            </label>
            <div className="actions-row form-actions-row">
              <button type="button" className="btn btn-sm btn-default" onClick={goBack}>‹ Indietro</button>
              <button type="submit" className="btn btn-md btn-primary">Salva</button>
            </div>
          </form>}
          </div>
      </div>
    </div>,
    document.body,
  );
}
