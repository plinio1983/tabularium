"use client";

import { useEffect, useState } from "react";
import IncomeForm from "@/components/IncomeForm";

export default function NewIncomePanel({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [returnAction, setReturnAction] = useState('/api/incomes');

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('new');
    const returnTo = `${url.pathname}${url.search}`;
    setReturnAction(`/api/incomes?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-income-new]')) return;

      event.preventDefault();
      setIsOpen(true);
    };

    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="grid">
      <div className="toolbar-card">
        <div>
          <h2>Incassi</h2>
          <p className="muted">Gestione delle entrate fiscali e non fiscali.</p>
        </div>
        <button className="button-standard primary-action" type="button" data-income-new>
          <span className="btn-icon">+</span>Aggiungi nuovo incasso
        </button>
      </div>

      {isOpen ? <div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true" aria-label="Aggiungi nuovo incasso" onMouseDown={() => setIsOpen(false)}>
        <div className="modal-card modal-card-wide" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-title">
            <div>
              <h3>Nuovo incasso</h3>
              <p className="muted">Inserisci un nuovo incasso senza uscire dalla lista.</p>
            </div>
            <button className="secondary-button modal-close-button" type="button" onClick={() => setIsOpen(false)}>×</button>
          </div>
          <IncomeForm action={returnAction} onCancel={() => setIsOpen(false)} />
        </div>
      </div> : null}
    </div>
  );
}
