"use client";

import {useEffect, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import Link from "next/link";
import FilterIcon from "@/components/FilterIcon";

type Option = {id: number; name: string; icon?: string | null};

type Props = {
    month: string;
    dateFrom: string;
    dateTo: string;
    paymentMethodId: number | null;
    salesChannelId: number | null;
    fiscal: string;
    paymentMethods: Option[];
    salesChannels: Option[];
};

function FilterField({label, icon, children}: {label: string; icon: string; children: ReactNode}) {
    return <div className="app-form-field record-filter-field">
        <span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">{icon}</span>{label}</span>
        {children}
    </div>;
}

export default function CashRegisterReceiptFiltersDrawer({
    month,
    dateFrom,
    dateTo,
    paymentMethodId,
    salesChannelId,
    fiscal,
    paymentMethods,
    salesChannels,
}: Props) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

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
            <aside className="filter-drawer-panel record-filter-drawer-panel" role="dialog" aria-modal="true" aria-label="Filtri report scontrini" onMouseDown={event => event.stopPropagation()}>
                <div className="filter-drawer-header">
                    <div><h3>Filtri report scontrini</h3></div>
                    <button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setOpen(false)} aria-label="Chiudi filtri">×</button>
                </div>

                <form className="record-filters recurring-drawer-filters record-styled-drawer-filters" action="/incomes/cash-register/receipts" method="get">
                    <fieldset className="filter-group filter-group-fiscal cash-register-receipt-period-filter-group">
                        <legend>Periodo</legend>
                        <FilterField label="Mese del report" icon="▦">
                            <input type="month" name="month" defaultValue={month}/>
                        </FilterField>
                        <FilterField label="Data inizio" icon="◷">
                            <input type="date" name="dateFrom" defaultValue={dateFrom}/>
                        </FilterField>
                        <FilterField label="Data fine" icon="◷">
                            <input type="date" name="dateTo" defaultValue={dateTo}/>
                        </FilterField>
                        <small className="muted filter-group-hint">Se imposti una data, l’intervallo libero sostituisce il mese selezionato.</small>
                    </fieldset>

                    <FilterField label="Metodo di pagamento" icon="●">
                        <select name="paymentMethodId" defaultValue={paymentMethodId ?? ""}>
                            <option value="">Tutti i metodi</option>
                            {paymentMethods.map(method => <option value={method.id} key={method.id}>{method.icon ? `${method.icon} ` : ""}{method.name}</option>)}
                        </select>
                    </FilterField>

                    <FilterField label="Canale di vendita" icon="◇">
                        <select name="salesChannelId" defaultValue={salesChannelId ?? ""}>
                            <option value="">Tutti i canali</option>
                            {salesChannels.map(channel => <option value={channel.id} key={channel.id}>{channel.icon ? `${channel.icon} ` : ""}{channel.name}</option>)}
                        </select>
                    </FilterField>

                    <FilterField label="Fiscalità" icon="%">
                        <select name="fiscal" defaultValue={fiscal}>
                            <option value="">Fiscali e non fiscali</option>
                            <option value="yes">Fiscali</option>
                            <option value="no">Non fiscali</option>
                        </select>
                    </FilterField>

                    <div className="filter-drawer-actions">
                        <Link className="btn btn-md btn-default reset-button" href="/incomes/cash-register/receipts" onClick={() => setOpen(false)}><span className="btn-icon">↺</span> Reset</Link>
                        <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">🔎</span> Filtra</button>
                    </div>
                </form>
            </aside>
        </div>,
        document.body,
    ) : null;

    return <>
        <button className="btn btn-sm btn-default recurring-filter-trigger" type="button" onClick={() => setOpen(true)}>
            <span className="btn-icon"><FilterIcon/></span><span className="recurring-filter-trigger-text">Filtri</span>
        </button>
        {drawer}
    </>;
}
