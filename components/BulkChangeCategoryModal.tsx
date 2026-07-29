"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type CategoryOption = {
  value: string;
  label: string;
  icon?: string | null;
};

type Props = {
  formId: string;
  action: string;
  fieldName: string;
  categories: CategoryOption[];
  title?: string;
  selectLabel?: string;
  hideTrigger?: boolean;
};

function selectedIdsForForm(formId: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[name="ids"][form="${formId}"]:checked, form#${formId} input[name="ids"]:checked`,
    ),
  ).map(input => input.value);
}

export default function BulkChangeCategoryModal({
  formId,
  action,
  fieldName,
  categories,
  title = "Cambia categoria",
  selectLabel = "Categoria",
  hideTrigger = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function openModal() {
    const ids = selectedIdsForForm(formId);
    if (!ids.length) return;
    setSelectedIds(ids);
    setIsOpen(true);
  }

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<{formId?: string}>).detail;
      if (detail?.formId !== formId) return;
      const ids = selectedIdsForForm(formId);
      if (!ids.length) return;
      setSelectedIds(ids);
      setIsOpen(true);
    };
    document.addEventListener("bulk-change-category-request", onRequest);
    return () => document.removeEventListener("bulk-change-category-request", onRequest);
  }, [formId]);

  const modal = isOpen ? <div className="app-form-modal-backdrop bulk-category-modal-backdrop" role="presentation">
    <div className="app-form-modal bulk-category-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-category-modal-title`}>
      <div className="modal-toolbar-card toolbar-card">
        <div>
          <h2 id={`${formId}-category-modal-title`}>{title}</h2>
          <p className="muted">Record selezionati: <strong>{selectedIds.length}</strong></p>
        </div>
        {/*<button type="button" className="btn btn-xs btn-default" onClick={() => setIsOpen(false)}>× Annulla</button>*/}
      </div>
      <form action={action} method="post" className="form bulk-category-modal-form">
        <input type="hidden" name="bulkAction" value="change_category" />
        {selectedIds.map(id => <input key={id} type="hidden" name="ids" value={id} />)}
        <label>{selectLabel}<select name={fieldName} required defaultValue="">
          <option value="" disabled>Seleziona categoria</option>
          {categories.map(category => <option key={category.value} value={category.value}>
            {category.icon ? `${category.icon} ${category.label}` : category.label}
          </option>)}
        </select></label>
        <div className="actions-row form-actions-row">
          <button type="button" className="btn btn-sm btn-default" onClick={() => setIsOpen(false)}>× Annulla</button>
          <button type="submit" className="btn btn-md btn-primary">Salva</button>
        </div>
      </form>
    </div>
  </div> : null;

  return <>
    {!hideTrigger ? <button className="btn btn-sm btn-default" type="button" onClick={openModal} data-bulk-change-category>
      <span className="btn-icon">🏷</span><span className="bulk-label">Cambia categoria</span>
    </button> : null}
    {modal ? createPortal(modal, document.body) : null}
  </>;
}
