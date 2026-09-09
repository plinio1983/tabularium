'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
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

export default function CashRegisterReceiptDetailModal({receiptId, onClose}: {
    receiptId: number;
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
        <div className="modal-card" ref={cardRef}>
            <div className="modal-title">
                <div><h3 id={titleId}>Scontrino #{receiptId}</h3><p className="muted">Dettaglio incasso del registratore di cassa</p></div>
                <button ref={closeRef} className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi dettaglio scontrino" onClick={onClose}>×</button>
            </div>
            {!receipt && !error ? <p role="status">Caricamento scontrino…</p> : null}
            {error ? <div role="alert"><p>{error}</p><button className="btn btn-sm btn-default" type="button" onClick={() => setRetry(value => value + 1)}>Riprova</button></div> : null}
            {receipt ? <div className="cash-register-receipt-detail-grid">
                {[
                    ['Descrizione', receipt.description || '—'],
                    ['Importo', euro(receipt.amount)],
                    ['Data e ora', new Intl.DateTimeFormat('it-IT', {dateStyle: 'long', timeStyle: 'short', timeZone}).format(new Date(receipt.creditDate))],
                    ['Canale di vendita', receipt.salesChannel],
                    ['Fiscalità', receipt.isFiscal ? 'Fiscale' : 'Non fiscale'],
                    ['Aliquota IVA', receipt.isFiscal ? `${receipt.vatRate}%` : 'Non applicabile'],
                    ['Metodo di pagamento', receipt.paymentMethod],
                    ['Banca / conto di accredito', receipt.bank]
                ].map(([label, value]) => <div className="record-detail-item" key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div> : null}
        </div>
    </div>, document.body);
}
