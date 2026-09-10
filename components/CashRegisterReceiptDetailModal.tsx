'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import {useCompanyTimeZone} from '@/components/CompanyTimeZoneProvider';
import {euro} from '@/lib/money';

type ReceiptDetail = {
    id: number;
    description: string | null;
    amount: number;
    creditDate: string;
    isFiscal: boolean;
    vatRate: number;
    salesChannel: string;
    paymentMethod: string;
    bank: string;
};

export default function CashRegisterReceiptDetailModal({receiptId, returnTo, onClose}: {
    receiptId: number;
    returnTo: string;
    onClose: () => void;
}) {
    const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const cardRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const timeZone = useCompanyTimeZone();

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setReceipt(null);
        setError('');
        fetch(`/api/cash-register/receipts/${receiptId}`, {cache: 'no-store', signal: controller.signal})
            .then(async response => {
                if (!response.ok) throw new Error(response.status === 404
                    ? 'Scontrino non trovato o non più disponibile.' : 'Impossibile caricare lo scontrino. Riprova.');
                const payload = await response.json();
                if (!controller.signal.aborted) setReceipt(payload.receipt);
            })
            .catch(reason => {if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Impossibile caricare lo scontrino.');});
        return () => controller.abort();
    }, [receiptId, retry]);

    return createPortal(<div className="modal-backdrop app-form-modal cash-register-receipt-detail-modal"
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}
        onKeyDown={event => {
            if (event.key === 'Escape') {event.stopPropagation(); onClose();}
            if (event.key !== 'Tab') return;
            const controls = cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
            if (!controls?.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
            if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
        }}>
        <div className="modal-card modal-card-wide record-detail-document cash-register-receipt-detail-card" ref={cardRef}>
            <div className="record-detail-action-row">
                <div className="left-side"><h3 id={titleId} className="record-detail-kicker">Scontrino #{receiptId}</h3></div>
                <div className="right-side">
                    {receipt ? <Link className="btn btn-sm btn-default" href={`/incomes/cash-register?editId=${receipt.id}&returnTo=${encodeURIComponent(returnTo)}`}>
                        <span aria-hidden="true">✎</span> Modifica
                    </Link> : null}
                    <button ref={closeRef} className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi dettaglio scontrino" onClick={onClose}>×</button>
                </div>
            </div>
            {!receipt && !error ? <div className="record-detail-section"><p role="status">Caricamento scontrino…</p></div> : null}
            {error ? <div className="record-detail-section" role="alert"><p className="inline-form-error">{error}</p><button className="btn btn-sm btn-default" type="button" onClick={() => setRetry(value => value + 1)}>Riprova</button></div> : null}
            {receipt ? <>
                <section className="record-detail-hero">
                    <div className="record-detail-title-block">
                        <p className="record-detail-kicker">Incasso da registratore di cassa</p>
                        <h2>{receipt.description?.trim() || 'Scontrino senza descrizione'}</h2>
                        <div className="record-detail-badge-row">
                            <span className={`badge ${receipt.isFiscal ? 'tone-ok' : 'tone-neutral'}`}>{receipt.isFiscal ? 'Fiscale' : 'Non fiscale'}</span>
                        </div>
                    </div>
                    <aside className="record-detail-amount-panel">
                        <div className="record-detail-amount-panel-header-row">
                            <span>{receipt.isFiscal ? 'IVA inclusa' : 'Importo incassato'}</span>
                            {receipt.isFiscal ? <span className="badge">{receipt.vatRate}%</span> : null}
                        </div>
                        <strong>{euro(receipt.amount)}</strong>
                        {!receipt.isFiscal ? <span>IVA non applicabile</span> : null}
                    </aside>
                </section>
                <section className="record-detail-section">
                    <div className="record-detail-section-heading"><div><h2>Dati incasso</h2><p>Data, canale e accredito dello scontrino.</p></div></div>
                    <div className="cash-register-receipt-detail-grid">
                        {[
                            ['Data e ora', new Intl.DateTimeFormat('it-IT', {dateStyle: 'long', timeStyle: 'short', timeZone}).format(new Date(receipt.creditDate))],
                            ['Canale di vendita', receipt.salesChannel],
                            ['Metodo di pagamento', receipt.paymentMethod],
                            ['Banca / conto di accredito', receipt.bank]
                        ].map(([label, value]) => <div className="record-detail-item" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}
                    </div>
                </section>
            </> : null}
        </div>
    </div>, document.body);
}
