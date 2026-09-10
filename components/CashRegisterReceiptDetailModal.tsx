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
        <div className="modal-card cash-register-receipt-detail-card" ref={cardRef}>
            <header className="receipt-detail-header">
                <span className="receipt-detail-symbol" aria-hidden="true"><ReceiptDetailIcon kind="receipt"/></span>
                <div><p>Registratore di cassa</p><h2 id={titleId}>Scontrino <span>#{receiptId}</span></h2></div>
                <button ref={closeRef} className="receipt-detail-close" type="button" aria-label="Chiudi dettaglio scontrino" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
                </button>
            </header>
            <div className="receipt-detail-body" aria-busy={!receipt && !error}>
                {!receipt && !error ? <div className="receipt-detail-loading" role="status">
                    <span className="receipt-detail-skeleton"/><span className="receipt-detail-skeleton"/>
                    <p>Caricamento scontrino…</p>
                </div> : null}
                {error ? <div className="receipt-detail-error" role="alert">
                    <span className="receipt-detail-error-icon" aria-hidden="true">!</span>
                    <h3>Dettaglio non disponibile</h3><p>{error}</p>
                    <button className="btn btn-md btn-default" type="button" onClick={() => setRetry(value => value + 1)}>Riprova</button>
                </div> : null}
                {receipt ? <>
                    <section className="receipt-detail-total" aria-label="Importo e fiscalità">
                        <div className="receipt-detail-status-row">
                            <span className={`receipt-detail-status ${receipt.isFiscal ? 'is-fiscal' : 'is-non-fiscal'}`}>
                                <span aria-hidden="true">{receipt.isFiscal ? '✓' : '—'}</span> {receipt.isFiscal ? 'Fiscale' : 'Non fiscale'}
                            </span>
                            <span className="receipt-detail-tax">{receipt.isFiscal ? `IVA ${receipt.vatRate}% inclusa` : 'IVA non applicabile'}</span>
                        </div>
                        <p className="receipt-detail-amount-label">Totale incassato</p>
                        <strong className="receipt-detail-amount">{euro(receipt.amount)}</strong>
                        <time className="receipt-detail-date" dateTime={receipt.creditDate}>
                            {new Intl.DateTimeFormat('it-IT', {dateStyle: 'long', timeZone}).format(new Date(receipt.creditDate))}
                            <span aria-hidden="true">·</span>
                            <span>ore {new Intl.DateTimeFormat('it-IT', {hour: '2-digit', minute: '2-digit', timeZone}).format(new Date(receipt.creditDate))}</span>
                        </time>
                    </section>
                    <section className="receipt-detail-information" aria-label="Dati dello scontrino">
                        <div className="receipt-detail-description">
                            <h3>Descrizione</h3>
                            <p className={!receipt.description?.trim() ? 'is-empty' : undefined}>{receipt.description?.trim() || 'Nessuna descrizione inserita'}</p>
                        </div>
                        <dl className="receipt-detail-facts">
                            {([
                                ['channel', 'Canale di vendita', receipt.salesChannel],
                                ['payment', 'Metodo di pagamento', receipt.paymentMethod],
                                ['bank', 'Conto di accredito', receipt.bank]
                            ] as const).map(([kind, label, value]) => <div className={`receipt-detail-fact is-${kind}`} key={kind}>
                                <dt><span className="receipt-detail-fact-icon" aria-hidden="true"><ReceiptDetailIcon kind={kind}/></span>{label}</dt>
                                <dd>{value?.trim() || 'Non specificato'}</dd>
                            </div>)}
                        </dl>
                    </section>
                </> : null}
            </div>
            <footer className="receipt-detail-footer">
                <button className="btn btn-md btn-default" type="button" onClick={onClose}>Chiudi</button>
                {receipt ? <Link className="btn btn-md btn-primary" href={`/incomes/cash-register?editId=${receipt.id}&returnTo=${encodeURIComponent(returnTo)}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m16 4 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>
                    Modifica scontrino
                </Link> : null}
            </footer>
        </div>
    </div>, document.body);
}

function ReceiptDetailIcon({kind}: {kind: 'receipt' | 'channel' | 'payment' | 'bank'}) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'receipt' ? <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6M9 11h6M9 15h3"/></> : null}
        {kind === 'channel' ? <><path d="m3 9 2-5h14l2 5M4 13v7h16v-7M9 20v-6h6v6"/><path d="M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9H3Z"/></> : null}
        {kind === 'payment' ? <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></> : null}
        {kind === 'bank' ? <><path d="m3 8 9-5 9 5H3ZM5 11v6m7-6v6m7-6v6M3 21h18M4 18h16"/></> : null}
    </svg>;
}
