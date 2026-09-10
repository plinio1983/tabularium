"use client";

import {useEffect, useId, useState, type ReactNode} from "react";
import FilterDrawer from "./FilterDrawer";
import EntityFormActions from "./EntityFormActions";
import {useRouter} from "next/navigation";
import FilterIcon from "@/components/FilterIcon";

import {periodOptions, isRollingPeriod} from '@/lib/period-selector';
import {resolveReceiptPeriod} from '@/lib/receipt-period';
import {dateInputInTimeZone} from '@/lib/company-time';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';

type Option = {id: number; name: string; icon?: string | null};

type Props = {
    search?: string;
    dateQuick: string;
    dateYear: string;
    years: string[];
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
    search = '',
    dateQuick,
    dateYear,
    years,
    dateFrom,
    dateTo,
    paymentMethodId,
    salesChannelId,
    fiscal,
    paymentMethods,
    salesChannels,
}: Props) {
    const timeZone = useCompanyTimeZone();
    const [selection, setSelection] = useState({quick: dateQuick, year: dateYear, from: dateFrom, to: dateTo});
    useEffect(() => setSelection({quick: dateQuick, year: dateYear, from: dateFrom, to: dateTo}), [dateQuick, dateYear, dateFrom, dateTo]);
    function selectPeriod(quick: string, year: string) {
        if (quick === 'custom') { setSelection(current => ({...current, quick})); return; }
        const period = resolveReceiptPeriod({dateQuick: quick, dateYear: year}, dateInputInTimeZone(timeZone));
        setSelection({quick: period.quick, year: String(period.year), from: period.from, to: period.to});
    }
    const [open, setOpen] = useState(false);
    const formId = useId();
    const router = useRouter();

    const drawer = <FilterDrawer open={open} onClose={() => setOpen(false)} title="Filtri report scontrini" panelClassName="record-filter-drawer-panel"
      actions={<EntityFormActions layout="drawer" formId={formId} onCancel={() => setOpen(false)} submitLabel="Filtra" onReset={() => {setOpen(false); router.push('/incomes/cash-register/receipts');}}/>}>
      <form id={formId} className="record-filters recurring-drawer-filters record-styled-drawer-filters receipt-drawer-filters" action="/incomes/cash-register/receipts" method="get">
        <input type="hidden" name="search" value={search}/>
        <fieldset className="filter-group cash-register-receipt-period-filter-group">
            <legend>Periodo</legend>
            <FilterField label="Periodo rapido" icon="▦">
                <select name="dateQuick" value={selection.quick} onChange={event => selectPeriod(event.target.value, selection.year)}>
                    {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </FilterField>
            <FilterField label="Anno" icon="▦">
                <select name="dateYear" value={selection.year} disabled={selection.quick === 'custom' || isRollingPeriod(selection.quick)} onChange={event => selectPeriod(selection.quick, event.target.value)}>
                    {Array.from(new Set([...years, selection.year])).sort((a, b) => Number(b) - Number(a)).map(year => <option key={year} value={year}>{year}</option>)}
                </select>
            </FilterField>
            <FilterField label="Data inizio" icon="◷">
                <input type="date" name={selection.quick === 'custom' ? 'dateFrom' : undefined} value={selection.from} onChange={event => setSelection(current => ({...current, quick: 'custom', from: event.target.value}))}/>
            </FilterField>
            <FilterField label="Data fine" icon="◷">
                <input type="date" name={selection.quick === 'custom' ? 'dateTo' : undefined} value={selection.to} onChange={event => setSelection(current => ({...current, quick: 'custom', to: event.target.value}))}/>
            </FilterField>
            <small className="muted filter-group-hint">Modificando le date imposti un periodo personalizzato.</small>
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

      </form>
    </FilterDrawer>;

    return <>
        <button className="btn btn-sm btn-default app-filter-trigger bulk-direct-link bulk-filter-action" data-bulk-filter="true" data-period-filter-source="receipt" type="button" onClick={() => setOpen(true)}>
            <span className="btn-icon"><FilterIcon/></span><span className="app-filter-trigger-text">Filtri</span>
        </button>
        {drawer}
    </>;
}
