'use client';
import {useEffect, useState} from 'react';
import ProductTrackingEditor, {type TrackingEditorRecord} from '@/components/ProductTrackingEditor';
import {useRouter} from 'next/navigation';

export default function ProductTrackingBulkController() {
  const router = useRouter();
  const [editing, setEditing] = useState<{record: TrackingEditorRecord; returnTo: string} | null>(null);
  useEffect(() => {
    let disposed = false;
    let loading = false;
    const edit = async (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest<HTMLElement>('[data-tracking-edit-id]');
      if (!trigger) return;
      event.preventDefault();
      if (loading || trigger.getAttribute('aria-disabled') === 'true') return;
      loading = true;
      trigger.setAttribute('aria-busy', 'true');
      const feedback = document.getElementById('tracking-bulk-feedback');
      try {
        const response = await fetch(`/api/product-trackings/${trigger.dataset.trackingEditId}/edit-data`, {cache: 'no-store'});
        const record = await response.json();
        if (!response.ok) throw new Error(record.error || 'Impossibile caricare la tracciatura.');
        const url = new URL(window.location.href);
        ['saved', 'error'].forEach(key => url.searchParams.delete(key));
        if (!disposed) setEditing({record, returnTo: `${url.pathname}${url.search}`});
      } catch (error) {
        if (!disposed && feedback) feedback.textContent = error instanceof Error ? error.message : 'Impossibile caricare la tracciatura.';
      } finally {loading = false; trigger.removeAttribute('aria-busy');}
    };
    document.addEventListener('click', edit);
    return () => {disposed = true; document.removeEventListener('click', edit);};
  }, []);
  useEffect(() => {
    let busy = false;
    const syncSelection = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.name !== 'ids' || target.getAttribute('form') !== 'trackingBulkForm') return;
      document.querySelectorAll<HTMLInputElement>('input[name="ids"][form="trackingBulkForm"]').forEach(input => {
        if (input.value === target.value) input.checked = target.checked;
      });
    };
    const submit = async (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.id !== 'trackingBulkForm') return;
      event.preventDefault();
      if (busy) return;
      const button = event.submitter;
      if (!(button instanceof HTMLButtonElement)) return;
      const ids = [...new Set(Array.from(document.querySelectorAll<HTMLInputElement>('input[name="ids"][form="trackingBulkForm"]:checked')).map(input => input.value))];
      if (!ids.length) return;
      const action = button.value;
      if (action === 'delete' && !window.confirm(`Eliminare ${ids.length} tracciature selezionate e tutti i relativi allegati?`)) return;
      busy = true;
      form.setAttribute('aria-busy', 'true');
      const feedback = document.getElementById('tracking-bulk-feedback');
      if (feedback) feedback.textContent = action === 'delete' ? 'Eliminazione in corso…' : 'Preparazione archivio…';
      try {
        const data = new FormData();
        ids.forEach(id => data.append('ids', id));
        data.set('bulkAction', action);
        const response = await fetch('/api/product-trackings/bulk', {method: 'POST', body: data});
        if (!response.ok) {const result = await response.json(); throw new Error(result.error || 'Operazione non riuscita.');}
        if (action === 'delete') {
          document.querySelectorAll<HTMLInputElement>('input[form="trackingBulkForm"]').forEach(input => {input.checked = false;});
          document.querySelector<HTMLInputElement>('input[name="ids"][form="trackingBulkForm"]')?.dispatchEvent(new Event('change', {bubbles: true}));
          if (feedback) feedback.textContent = 'Tracciature eliminate.';
          router.refresh();
        } else {
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement('a');
          link.href = url; link.download = `tracciature-${action === 'invoices' ? 'fatture' : 'documenti'}.zip`;
          document.body.appendChild(link); link.click(); link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          if (feedback) feedback.textContent = 'Archivio pronto.';
        }
      } catch (error) {
        if (feedback) feedback.textContent = error instanceof Error ? error.message : 'Operazione non riuscita.';
      } finally {busy = false; form.removeAttribute('aria-busy');}
    };
    document.addEventListener('submit', submit);
    document.addEventListener('change', syncSelection, true);
    return () => {
      document.removeEventListener('submit', submit);
      document.removeEventListener('change', syncSelection, true);
    };
  }, [router]);
  return <>
    <p id="tracking-bulk-feedback" role="status" aria-live="polite"/>
    {editing && <ProductTrackingEditor key={editing.record.id} initiallyOpen record={editing.record} returnTo={editing.returnTo} onClose={() => setEditing(null)}/>}
  </>;
}
