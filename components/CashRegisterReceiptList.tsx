'use client';

import Link from 'next/link';
import {useState} from 'react';
import BulkSelectionController from '@/components/BulkSelectionController';
import {euro} from '@/lib/money';

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

function receiptDate(value: string) {
    const parts = new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(item => item.type === type)?.value.replace('.', '') ?? '';
    const month = part('month');
    return `${part('day')} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${part('hour')}:${part('minute')}`;
}

export default function CashRegisterReceiptList({receipts}: {receipts: Receipt[]}) {
    const formId = 'cashRegisterReceiptBulkForm';
    const returnTo = encodeURIComponent('/incomes/cash-register/receipts');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const allSelected = receipts.length > 0 && selectedIds.length === receipts.length;
    const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
    const anySelected = selectedIds.length > 0;

    function toggleReceipt(id: number, checked: boolean) {
        setSelectedIds(current => checked
            ? current.includes(id) ? current : [...current, id]
            : current.filter(item => item !== id));
    }

    return <div className="card record-list-card cash-register-receipt-list-card">
        <BulkSelectionController/>
        <form id={formId}
              action={`/api/cash-register/receipts/bulk?returnTo=${returnTo}`}
              method="post"
              className="bulk-actions-bar grouped-bulk-actions-bar cash-register-receipt-bulk-actions-bar confirm-bulk-form"
              data-bulk-button-group="true"
              data-bulk-subject="scontrini">
            <label className="bulk-select-all-inline cash-register-select-all">
                <input type="checkbox" className="bulk-select-all" data-bulk-target={formId}
                       checked={allSelected}
                       onChange={event => setSelectedIds(event.currentTarget.checked ? receipts.map(receipt => receipt.id) : [])}
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
                <a href={singleId ? `/incomes/cash-register?editId=${singleId}&returnTo=${returnTo}` : "#"}
                   className={`bulk-direct-link ${singleId ? "" : "is-disabled"}`} data-bulk-edit
                   aria-disabled={singleId ? "false" : "true"}>
                    <span className="btn-icon">✎</span><span className="bulk-label">Modifica</span>
                </a>
                <a href={singleId ? `/incomes/cash-register?copyId=${singleId}&returnTo=${returnTo}` : "#"}
                   className={`bulk-direct-link ${singleId ? "" : "is-disabled"}`} data-bulk-copy
                   aria-disabled={singleId ? "false" : "true"}>
                    <span className="btn-icon">⧉</span><span className="bulk-label">Copia</span>
                </a>
                <button type="submit" className="bulk-direct-link bulk-direct-danger hidden-sp"
                        name="bulkAction" value="delete" data-bulk-delete disabled={!anySelected}>
                    <span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span>
                </button>
              </div>
            </div>
            <div className="bulk-inner-container">
                <Link className="bulk-direct-link btn btn-md btn-primary"
                      href="/incomes/cash-register"
                      data-bulk-new
                      data-floating-label="Scontrino"
                      data-floating-icon="+">
                    <span className="btn-icon">+</span><span className="bulk-label">Scontrino</span>
                </Link>
            </div>
        </form>

        <div className="cash-register-receipt-list" aria-label="Lista scontrini">
            {receipts.map(receipt => <article className="cash-register-receipt-row" key={receipt.id}>
                <div className="mobile-record-select cash-register-receipt-select">
                    <input form={formId} type="checkbox" name="ids" value={receipt.id}
                           checked={selectedIds.includes(receipt.id)}
                           onChange={event => toggleReceipt(receipt.id, event.currentTarget.checked)}
                           aria-label={`Seleziona scontrino ${receipt.id}`}/>
                </div>
                <div className="cash-register-receipt-content">
                    <div className="cash-register-receipt-date">
                        <small>#{receipt.id}</small>
                        <strong>{receiptDate(receipt.creditDate)}</strong>
                    </div>
                    <div className="cash-register-receipt-channel">
                        <span>{receipt.salesChannelIcon ?? ''} {receipt.salesChannel}</span>
                        <small>{receipt.isFiscal ? `Fiscale · IVA ${receipt.vatRate}%` : 'Non fiscale'}</small>
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
