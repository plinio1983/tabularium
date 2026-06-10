"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

type Props = {
  filters: Record<string, string | string[] | undefined>;
};

function inputDefault(filters: Record<string, string | string[] | undefined>, key: string) {
  const value = filters[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function SupplierFiltersDrawer({ filters }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.classList.add("drawer-open");
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("drawer-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const drawer = mounted ? createPortal(
    <div className={open ? "filter-drawer-backdrop is-open" : "filter-drawer-backdrop"} onMouseDown={() => setOpen(false)} aria-hidden={!open}>
      <aside className="filter-drawer-panel expense-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri fornitori" onMouseDown={(event) => event.stopPropagation()}>
        <div className="filter-drawer-header">
          <div>
            <h3>Filtri fornitori</h3>
            <p className="muted">Cerca per ragione sociale, alias, contatti e codice fiscale/SDI.</p>
          </div>
          <button className="secondary-button modal-close-button" type="button" onClick={() => setOpen(false)}>×</button>
        </div>

        <form className="expense-filters recurring-drawer-filters supplier-filters" action="/suppliers" method="get">
          <label>Ragione sociale<input name="businessName" defaultValue={inputDefault(filters, "businessName")} /></label>
          <label>Alias<input name="alias" defaultValue={inputDefault(filters, "alias")} /></label>
          <label>Email<input name="email" type="email" defaultValue={inputDefault(filters, "email")} /></label>
          <label>Telefono<input name="phone" defaultValue={inputDefault(filters, "phone")} /></label>
          <label>PEC<input name="pec" defaultValue={inputDefault(filters, "pec")} /></label>
          <label>Codice SDI/C.F.<input name="taxCodeSdi" defaultValue={inputDefault(filters, "taxCodeSdi")} /></label>

          <div className="filter-drawer-actions">
            <Link className="button-standard secondary-button reset-button" href="/suppliers" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
            <button className="button-standard primary-action" type="submit"><span className="btn-icon">🔎</span> Filtra</button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  ) : null;

  return <>
    <button className="button-standard secondary-button recurring-filter-trigger" type="button" onClick={() => setOpen(true)}>
      <span className="btn-icon">☰</span> <span className="recurring-filter-trigger-text">Filtri</span>
    </button>
    {drawer}
  </>;
}
