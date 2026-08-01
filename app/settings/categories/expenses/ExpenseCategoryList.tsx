'use client';

import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import CategoryDeleteForm from '../CategoryDeleteForm';
import MobileFormStickyActions from '@/components/MobileFormStickyActions';

type Action = (formData: FormData) => void | Promise<void>;

type Category = {
  id: number;
  name: string;
  code: string;
  icon: string | null;
  usageCount: number;
};

type Props = {
  categories: Category[];
  iconOptions: readonly string[];
  updateAction: Action;
  deleteAction: Action;
};

export default function ExpenseCategoryList({categories, iconOptions, updateAction, deleteAction}: Props) {
  const [editing, setEditing] = useState<Category | null>(null);

  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [editing]);

  return <>
    <section className="card expense-category-list-card" aria-label="Categorie di spesa">
      <div className="expense-category-list-heading">
        <div>
          <h3>Categorie configurate</h3>
          <p className="muted">{categories.length} {categories.length === 1 ? 'categoria' : 'categorie'}</p>
        </div>
      </div>
      {categories.length ? <div className="expense-category-settings-list">
        {categories.map(category => <article className="expense-category-settings-item" key={category.id}>
          <span className="expense-category-settings-icon" aria-hidden="true">{category.icon || '•'}</span>
          <div className="expense-category-settings-copy">
            <strong>{category.name}</strong>
            <span><b>{category.code}</b> · {category.usageCount} {category.usageCount === 1 ? 'movimento' : 'movimenti'}</span>
          </div>
          <div className="expense-category-settings-actions">
            <CategoryDeleteForm id={category.id} name={category.name} action={deleteAction}/>
            <button className="btn btn-xs btn-primary" type="button" onClick={() => setEditing(category)}>
              <span className="btn-icon" aria-hidden="true">✎</span> Modifica
            </button>
          </div>
        </article>)}
      </div> : <p className="muted">Nessuna categoria configurata.</p>}
    </section>

    {editing ? createPortal(
      <div className="modal-backdrop app-form-modal expense-category-edit-backdrop" role="presentation" onMouseDown={event => {
        if (event.target === event.currentTarget) setEditing(null);
      }}>
        <section className="modal-card expense-category-edit-modal" role="dialog" aria-modal="true" aria-labelledby="expense-category-edit-title" onMouseDown={event => event.stopPropagation()}>
          <div className="toolbar-card modal-toolbar-card expense-category-edit-toolbar">
            <div>
              <h2 id="expense-category-edit-title">Modifica categoria</h2>
              <p className="muted">{editing.icon ?? ''} {editing.name}</p>
            </div>
            <button className="btn btn-icon-only btn-default" type="button" aria-label="Chiudi" onClick={() => setEditing(null)}>×</button>
          </div>
          <form action={updateAction} className="form app-record-form expense-category-edit-form">
            <input type="hidden" name="id" value={editing.id}/>
            <div className="app-form-field span-2">
              <label className="app-form-field-label" htmlFor="expense-category-name">
                <span className="app-form-field-icon" aria-hidden="true">✎</span>
                <span>Nome</span>
              </label>
              <input id="expense-category-name" name="name" defaultValue={editing.name} maxLength={80} required autoFocus/>
            </div>
            <div className="app-form-field">
              <label className="app-form-field-label" htmlFor="expense-category-code">
                <span className="app-form-field-icon" aria-hidden="true">#</span>
                <span>Acronimo</span>
              </label>
              <input id="expense-category-code" name="code" defaultValue={editing.code} maxLength={5} pattern="[A-Za-z0-9]{1,5}" required/>
              <small className="app-form-field-hint">Massimo 5 lettere o numeri.</small>
            </div>
            <div className="app-form-field">
              <label className="app-form-field-label" htmlFor="expense-category-icon">
                <span className="app-form-field-icon" aria-hidden="true">◇</span>
                <span>Icona</span>
              </label>
              <div className="app-select-control">
                <select id="expense-category-icon" name="icon" defaultValue={editing.icon ?? ''}>
                  <option value="">Nessuna</option>
                  {iconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                </select>
                <span className="app-select-caret" aria-hidden="true">⌄</span>
              </div>
            </div>
            <div className="actions-row full form-actions-row expense-category-edit-actions">
              <button className="btn btn-md btn-default" type="button" onClick={() => setEditing(null)}>× Annulla</button>
              <button className="btn btn-md btn-primary" type="submit">✓ Salva categoria</button>
            </div>
            <MobileFormStickyActions
              currentStep={1}
              submitStep={1}
              onBack={() => undefined}
              onNext={() => undefined}
              onCancel={() => setEditing(null)}
              submitLabel="Salva categoria"
            />
          </form>
        </section>
      </div>,
      document.body
    ) : null}
  </>;
}
