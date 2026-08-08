'use client';

import Link from 'next/link';
import type {ReactNode} from 'react';
import BulkSelectionController from '@/components/BulkSelectionController';
import SortableTableController from '@/components/SortableTableController';
import {euro} from '@/lib/money';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';

type Receipt = {
    id: number;
    amount: number;
    creditDate: string;
    isFiscal: boolean;
    vatRate: number;
    salesChannelId: number;
    paymentMethodId: number;
    salesChannel: string;
    salesChannelIcon: string | null;
    paymentMethod: string;
    paymentMethodIcon: string | null;
};

function receiptDate(value: string, timeZone: string) {
    const parts = new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(item => item.type === type)?.value.replace('.', '') ?? '';
    const month = part('month');
    return `${part('day')} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${part('hour')}:${part('minute')}`;
}

export default function CashRegisterReceiptList({receipts, filtersTrigger}: {receipts: Receipt[]; filtersTrigger?: ReactNode}) {
    const timeZone = useCompanyTimeZone();
    const formId = 'cashRegisterReceiptBulkForm';
    const returnTo = encodeURIComponent('/incomes/cash-register/receipts');
    return <div className="card record-list-card cash-register-receipt-list-card">
        <div className="list-heading recurring-list-heading">
            <div><h2>Lista scontrini</h2><p className="muted">Risultati mostrati: {receipts.length}</p></div>
            {filtersTrigger}
        </div>
        <BulkSelectionController/>
        <SortableTableController/>
        <form id={formId}
              action={`/api/cash-register/receipts/bulk?returnTo=${returnTo}`}
              method="post"
              className="bulk-actions-bar grouped-bulk-actions-bar cash-register-receipt-bulk-actions-bar confirm-bulk-form"
              data-bulk-button-group="true"
              data-bulk-subject="scontrini">
            <label className="bulk-select-all-inline cash-register-select-all">
                <input type="checkbox" className="bulk-select-all" data-bulk-target={formId}
                       aria-label="Seleziona tutti gli scontrini visibili"/>
            </label>
            <div className="bulk-action-buttons btn-group">
              <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form={formId}>
                <summary className="bulk-action-trigger">
                    <span className="btn-icon hidden-mobile">⚙</span><span className="hidden-sm-up">Actions</span><span className="hidden-sm-down">Bulk actions</span>
                </summary>
                <div className="bulk-action-menu-panel">
                    <button className="btn btn-sm btn-default danger-menu-item bulk-menu-mobile-delete" type="submit" name="bulkAction" value="delete">
                        <span className="btn-icon">🗑</span><span className="bulk-label">Rimuovi selezionati</span>
                    </button>
                </div>
              </details>
              <div className="bulk-direct-actions"
                 data-bulk-direct-actions
                 data-bulk-form={formId}
                 data-edit-base="/incomes/cash-register?editId="
                 data-edit-suffix=""
                 data-copy-base="/incomes/cash-register?copyId="
                 data-copy-single-only="true"
                 data-return-to={returnTo}>
                <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true">
                    <span className="btn-icon">✎</span><span className="bulk-label">Modifica</span>
                </a>
                <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true">
                    <span className="btn-icon">⧉</span><span className="bulk-label">Copia</span>
                </a>
                <button type="submit" className="bulk-direct-link bulk-direct-danger hidden-sp"
                        name="bulkAction" value="delete" data-bulk-delete disabled>
                    <span className="btn-icon icon-small">🗑</span><span className="bulk-label">Elimina</span>
                </button>
              </div>
            </div>
            <div className="bulk-inner-container">
                <Link className="bulk-direct-link bulk-add-link btn btn-md btn-primary"
                      href="/incomes/cash-register"
                      data-bulk-new
                      data-floating-label="Scontrino"
                      data-floating-icon="+">
                    <span className="btn-icon">+</span><span className="bulk-label">Scontrino</span>
                </Link>
            </div>
        </form>

        <div className="table-scroll cash-register-receipt-table-scroll">
            <table className="expenses-table compact-incomes-table cash-register-receipt-table"
                   data-sortable-table data-default-sort="date" data-default-sort-dir="desc">
                <thead>
                <tr>
                    <th className="cell-option">
                        <input type="checkbox" className="bulk-select-all" data-bulk-target={formId}
                               aria-label="Seleziona tutti gli scontrini visibili"/>
                    </th>
                    <th data-sort-key="id" data-sort-type="number">ID</th>
                    <th data-sort-key="date" data-sort-type="date">Data e ora</th>
                    <th data-sort-key="channel">Canale vendita</th>
                    <th data-sort-key="fiscal">Fiscalità</th>
                    <th data-sort-key="vat" data-sort-type="number">IVA</th>
                    <th data-sort-key="method">Metodo pagamento</th>
                    <th className="cell-amount" data-sort-key="amount" data-sort-type="number">Importo</th>
                </tr>
                </thead>
                <tbody>
                {receipts.map(receipt => <tr key={receipt.id}
                    data-sort-row
                    data-sort-id={String(receipt.id)}
                    data-sort-date={String(new Date(receipt.creditDate).getTime())}
                    data-sort-channel={receipt.salesChannel}
                    data-sort-fiscal={receipt.isFiscal ? '1' : '0'}
                    data-sort-vat={String(receipt.isFiscal ? receipt.vatRate : 0)}
                    data-sort-method={receipt.paymentMethod}
                    data-sort-amount={String(receipt.amount)}>
                    <td className="cell-option">
                        <input form={formId} type="checkbox" name="ids" value={receipt.id}
                               aria-label={`Seleziona scontrino ${receipt.id}`}/>
                    </td>
                    <td>#{receipt.id}</td>
                    <td>{receiptDate(receipt.creditDate, timeZone)}</td>
                    <td>{receipt.salesChannelIcon ?? '•'} {receipt.salesChannel}</td>
                    <td><span className={`badge ${receipt.isFiscal ? 'tone-yes' : 'tone-no'}`}>
                        {receipt.isFiscal ? '✓ Fiscale' : '✕ Non fiscale'}
                    </span></td>
                    <td>{receipt.isFiscal ? <span className="badge tone-neutral">{receipt.vatRate}%</span> : '—'}</td>
                    <td>{receipt.paymentMethodIcon ?? '•'} {receipt.paymentMethod}</td>
                    <td className="cell-amount"><strong className="text-accent">{euro(receipt.amount)}</strong></td>
                </tr>)}
                {!receipts.length ? <tr><td colSpan={8}>Nessuno scontrino nel periodo selezionato.</td></tr> : null}
                </tbody>
            </table>
        </div>

        <div className="cash-register-receipt-list cash-register-receipt-mobile-list" aria-label="Lista scontrini">
            {receipts.map(receipt => <article className="cash-register-receipt-row" key={receipt.id}>
                <div className="mobile-record-select cash-register-receipt-select">
                    <input form={formId} type="checkbox" name="ids" value={receipt.id}
                           aria-label={`Seleziona scontrino ${receipt.id}`}/>
                </div>
                <div className="cash-register-receipt-content">
                    <div className="cash-register-receipt-date">
                        <small>#{receipt.id}</small>
                        <strong>{receiptDate(receipt.creditDate, timeZone)}</strong>
                    </div>
                    <div className="cash-register-receipt-channel">
                        <span>{receipt.salesChannelIcon ?? ''} {receipt.salesChannel}</span>
                        <small>
                            <span>{receipt.isFiscal ? `✓ Fiscale · ` : '✕ Non fiscale '}</span>
                            <strong>{receipt.isFiscal ? ` IVA ${receipt.vatRate}%` : ''}</strong>
                        </small>
                    </div>
                    <div className="cash-register-receipt-method">
                        <span>{receipt.paymentMethodIcon ?? ''} {receipt.paymentMethod}</span>
                    </div>
                    <strong className="cash-register-receipt-amount">{euro(receipt.amount)}</strong>
                </div>
            </article>)}
            {!receipts.length ? <div className="record-empty-state">Nessuno scontrino nel periodo selezionato.</div> : null}
        </div>
    </div>;
}
