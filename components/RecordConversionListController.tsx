'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import RecordConversionForm, {type RecordConversionFormProps} from './RecordConversionForm';
import RecordConversionModal from './RecordConversionModal';

type OpenDetail = {kind: 'expenses' | 'incomes'; id: number; formId: string};

export default function RecordConversionListController({kind, formId, returnHref}: {
    kind: OpenDetail['kind']; formId: string; returnHref: string;
}) {
    const [form, setForm] = useState<RecordConversionFormProps | null>(null);
    const [loadingId, setLoadingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const request = useRef<AbortController | null>(null);
    const close = useCallback(() => {
        request.current?.abort();
        request.current = null;
        setForm(null);
        setLoadingId(null);
        setError('');
    }, []);

    useEffect(() => {
        async function open(event: Event) {
            const detail = (event as CustomEvent<OpenDetail>).detail;
            if (!detail || detail.kind !== kind || detail.formId !== formId || !Number.isSafeInteger(detail.id) || detail.id <= 0) return;
            request.current?.abort();
            const controller = new AbortController();
            request.current = controller;
            setForm(null);
            setError('');
            setLoadingId(detail.id);
            try {
                const response = await fetch(`/api/${kind}/${detail.id}/convert`, {signal: controller.signal, cache: 'no-store'});
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (!response.ok) throw new Error(data.error || 'Impossibile caricare la conversione.');
                setForm(data);
                setLoadingId(null);
            } catch (cause) {
                if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Connessione non disponibile. Riprova.');
            }
        }
        document.addEventListener('record-conversion:open', open);
        return () => {
            document.removeEventListener('record-conversion:open', open);
            request.current?.abort();
        };
    }, [kind, formId]);

    if (form) return <RecordConversionForm {...form} returnHref={returnHref} onClose={close} onSaved={close}/>;
    if (loadingId === null) return null;
    return <RecordConversionModal title={`Converti ${kind === 'expenses' ? 'spesa' : 'incasso'} #${loadingId}`} description="" help={null} busy={false} onClose={close}>
        {error ? <p role="alert" className="text-critical">{error}</p> : <p role="status">Caricamento…</p>}
    </RecordConversionModal>;
}
