'use client';

import {useState} from 'react';
import ExpenseCategoryFormModal from './ExpenseCategoryFormModal';

type Props = {action: (formData: FormData) => void | Promise<void>; iconOptions: readonly string[]};

export default function CategoryCreatePanel({action, iconOptions}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  return <>
    <section className="card category-create-panel">
      <button type="button" className="category-create-toggle" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen(true)}>
        <span className="category-create-toggle-copy">
          <span className="category-create-toggle-icon btn-icon btn-icon-add" aria-hidden="true">＋</span>
          <span><strong>Nuova categoria</strong><small>Aggiungi un nuovo valore disponibile nei form di spesa.</small></span>
        </span>
        <span className="category-create-toggle-state btn-icon" aria-hidden="true">＋</span>
      </button>
    </section>
    {isOpen ? <ExpenseCategoryFormModal action={action} iconOptions={iconOptions} onClose={() => setIsOpen(false)}/> : null}
  </>;
}
