'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

type DeleteActionButtonProps = {
  action: string;
  confirmMessage: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
};

export default function DeleteActionButton({
  action,
  confirmMessage,
  title = 'Elimina',
  ariaLabel = 'Elimina',
  className = 'btn btn-xs btn-danger icon-action',
  children = <span className="btn-icon">🗑️</span>
}: DeleteActionButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    if (isDeleting) return;
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set('_action', 'delete');
      const response = await fetch(action, {
        method: 'POST',
        body: formData,
        redirect: 'follow'
      });

      if (response.redirected && response.url) {
        window.location.assign(response.url);
        return;
      }

      if (response.ok) {
        window.location.reload();
        return;
      }

      alert('Non è stato possibile eliminare il record. Riprova.');
      setIsDeleting(false);
    } catch (error) {
      console.error(error);
      alert('Errore durante l’eliminazione del record.');
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
      disabled={isDeleting}
    >
      {isDeleting ? <span className="btn-icon">…</span> : children}
    </button>
  );
}
