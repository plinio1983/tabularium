'use client';

import {useState} from 'react';
import ExpenseCategoryFormModal from '../ExpenseCategoryFormModal';
import CategoryDeleteForm from '../CategoryDeleteForm';

type Action = (formData: FormData) => void | Promise<void>;

type Category = {
  id: number;
  name: string;
  code: string;
  icon: string | null;
  usageCount: number;
  protected: boolean;
};

type Props = {
  categories: Category[];
  iconOptions: readonly string[];
  updateAction: Action;
  deleteAction: Action;
};

export default function ExpenseCategoryList({categories, iconOptions, updateAction, deleteAction}: Props) {
  const [editing, setEditing] = useState<Category | null>(null);

  return <>
    <section className="card settings-entity-list-card" aria-label="Categorie di spesa">
      <div className="settings-entity-list-heading">
        <div>
          <h3>Categorie configurate</h3>
          <p className="muted">{categories.length} {categories.length === 1 ? 'categoria' : 'categorie'}</p>
        </div>
      </div>
      {categories.length ? <div className="settings-entity-list">
        {categories.map(category => <article className="settings-entity-item" key={category.id}>
          <span className="settings-entity-icon" aria-hidden="true">{category.icon || '•'}</span>
          <div className="settings-entity-copy">
            <strong>{category.name}</strong>
            <span><b>{category.code}</b> · {category.usageCount} {category.usageCount === 1 ? 'movimento' : 'movimenti'} {category.protected ? '· Categoria protetta' : ''}</span>
          </div>
          <div className="settings-entity-actions">
            {!category.protected ? <CategoryDeleteForm id={category.id} name={category.name} action={deleteAction}/> : null}
            <button className="btn btn-xs btn-primary" type="button" onClick={() => setEditing(category)}>
              <span className="btn-icon" aria-hidden="true">✎</span> Modifica
            </button>
          </div>
        </article>)}
      </div> : <p className="muted">Nessuna categoria configurata.</p>}
    </section>

    {editing ? <ExpenseCategoryFormModal category={editing} action={updateAction} iconOptions={iconOptions} onClose={() => setEditing(null)}/> : null}
  </>;
}
