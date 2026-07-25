import Link from 'next/link';
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

    return <div className="card expenses-list-card cash-register-receipt-list-card">
        <BulkSelectionController/>
        <form id={formId}
              action={`/api/cash-register/receipts/bulk?returnTo=${returnTo}`}
              method="post"
              className="bulk-actions-bar confirm-bulk-form"
              data-bulk-subject="scontrini">
            <label className="bulk-select-all-inline">
                <input type="checkbox" className="bulk-select-all" data-bulk-target={formId}
                       aria-label="Seleziona tutti gli scontrini visibili"/>
            </label>
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
                <button type="submit" className="bulk-direct-link bulk-direct-danger"
                        name="bulkAction" value="delete" data-bulk-delete disabled>
                    <span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span>
                </button>
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
                <div className="expense-mobile-select cash-register-receipt-select">
                    <input form={formId} type="checkbox" name="ids" value={receipt.id}
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
            {!receipts.length ? <div className="expense-empty-panel">Nessuno scontrino nel periodo selezionato.</div> : null}
        </div>
    </div>;
}
