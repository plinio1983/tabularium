'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {appendFlash} from '@/lib/flash';
import {preparePageReturn} from '@/lib/page-transition';

export default function ProductTrackingDelete({id, returnTo = '/product-trackings', className = 'btn btn-sm btn-danger'}: {id: number; returnTo?: string; className?: string}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <>
    <button type="button" title="Elimina" aria-label="Elimina tracciatura" className={className} disabled={busy} onClick={async () => {
      if (busy || !window.confirm('Confermi la rimozione della tracciatura e di tutti i suoi allegati? L’operazione non può essere annullata.')) return;
      setBusy(true); setError('');
      try {
        const response = await fetch(`/api/product-trackings/${id}`, {method: 'DELETE'});
        if (!response.ok) throw new Error((await response.json()).error || 'Impossibile eliminare la tracciatura.');
        preparePageReturn(returnTo); router.push(appendFlash(returnTo, {saved: 'deleted'})); router.refresh();
      } catch (err) {setError(err instanceof Error ? err.message : 'Impossibile eliminare la tracciatura.'); setBusy(false);}
    }}><span className="btn-icon" aria-hidden="true">{busy ? '…' : '🗑'}</span> Elimina</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </>;
}
