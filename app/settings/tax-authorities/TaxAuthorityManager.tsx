'use client';

import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

type Action = (formData: FormData) => void | Promise<void>;
type Category = {id: number; name: string; icon: string | null};
type Authority = {
  id: number; name: string; kind: string; defaultDescription: string | null;
  defaultExpenseCategoryId: number | null; iban: string | null; notes: string | null;
  isActive: boolean; isSystemDefault: boolean; usageCount: number;
};
type Props = {authorities: Authority[]; categories: Category[]; saveAction: Action; toggleAction: Action};

const kinds = [['FISCAL','Fiscale'],['SOCIAL_SECURITY','Previdenziale'],['INSURANCE','Assicurativo'],['LOCAL','Ente locale'],['COLLECTION','Riscossione'],['OTHER','Altro']] as const;

export default function TaxAuthorityManager({authorities, categories, saveAction, toggleAction}: Props) {
  const [editing, setEditing] = useState<Authority | 'new' | null>(null);
  useEffect(() => {
    if (!editing) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setEditing(null); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', close); };
  }, [editing]);

  const current = editing === 'new' ? null : editing;
  const modal = editing ? createPortal(<div className="modal-backdrop app-form-modal tax-authority-modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) setEditing(null);
  }}><section className="modal-card settings-form-modal tax-authority-modal" role="dialog" aria-modal="true" aria-labelledby="tax-authority-modal-title">
    <div className="toolbar-card modal-toolbar-card"><div><h2 id="tax-authority-modal-title">{current ? 'Modifica ente' : 'Nuovo ente'}</h2><p className="muted">{current?.name ?? 'Aggiungi un beneficiario per imposte e contributi.'}</p></div><button className="btn btn-icon-only btn-default modal-close-button" type="button" aria-label="Chiudi" onClick={() => setEditing(null)}>×</button></div>
    <form action={saveAction} className="card form app-record-form tax-authority-modal-form">
      {current ? <input type="hidden" name="id" value={current.id}/> : null}
      {current ? <input type="hidden" name="isActive" value={current.isActive ? 'on' : ''}/> : null}
      <label className="app-form-field"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">🏛</span><span>Nome ente</span></span><input name="name" defaultValue={current?.name ?? ''} placeholder="Es. Agenzia delle Entrate" maxLength={120} required autoFocus/></label>
      <label className="app-form-field"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">◇</span><span>Tipologia</span></span><span className="app-select-control"><select name="kind" defaultValue={current?.kind ?? 'FISCAL'}>{kinds.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><span className="app-select-caret" aria-hidden="true">⌄</span></span></label>
      <label className="app-form-field"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">◇</span><span>Categoria predefinita</span></span><span className="app-select-control"><select name="defaultExpenseCategoryId" defaultValue={current?.defaultExpenseCategoryId ?? ''}><option value="">Nessuna categoria predefinita</option>{categories.map(category => <option value={category.id} key={category.id}>{category.icon ?? ''} {category.name}</option>)}</select><span className="app-select-caret" aria-hidden="true">⌄</span></span></label>
      <label className="app-form-field"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">▥</span><span>IBAN</span></span><input name="iban" defaultValue={current?.iban ?? ''} placeholder="Es. IT60X0542811101000000123456" maxLength={34}/></label>
      <label className="app-form-field full"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">▤</span><span>Descrizione predefinita</span></span><input name="defaultDescription" defaultValue={current?.defaultDescription ?? ''} placeholder="Es. Versamento imposte e contributi" maxLength={200}/><small>Viene proposta quando si seleziona l’ente in una nuova imposta.</small></label>
      <label className="app-form-field full"><span className="app-form-field-label"><span className="app-form-field-icon" aria-hidden="true">≡</span><span>Note interne</span></span><textarea name="notes" defaultValue={current?.notes ?? ''} placeholder="Annotazioni, riferimenti o istruzioni interne" rows={3}/></label>
      <footer className="actions-row full tax-authority-modal-actions"><button className="btn btn-md btn-default" type="button" onClick={() => setEditing(null)}>× Annulla</button><button className="btn btn-md btn-primary" type="submit">✓ {current ? 'Salva modifiche' : 'Aggiungi ente'}</button></footer>
    </form>
  </section></div>, document.body) : null;

  return <>
    <section className="card category-create-panel tax-authority-create-panel"><button type="button" className="category-create-toggle" onClick={() => setEditing('new')}><span className="category-create-toggle-copy"><span className="category-create-toggle-icon" aria-hidden="true">🏛</span><span><strong>Nuovo ente fiscale o previdenziale</strong><small>Aggiungi un beneficiario disponibile nel form Imposte.</small></span></span><span className="category-create-toggle-symbol" aria-hidden="true">+</span></button></section>
    <section className="card settings-entity-list-card tax-authority-list-card"><div className="settings-entity-list-heading"><div><h3>Enti configurati</h3><p className="muted">{authorities.length} {authorities.length === 1 ? 'ente' : 'enti'}</p></div></div>
      <div className="settings-entity-list">{authorities.map(authority => <article className={`settings-entity-item tax-authority-item${authority.isActive ? '' : ' is-archived'}`} key={authority.id}>
        <span className="settings-entity-icon" aria-hidden="true">🏛</span><div className="settings-entity-copy"><strong>{authority.name}</strong><span>{kinds.find(([value]) => value === authority.kind)?.[1] ?? authority.kind} · {authority.usageCount} {authority.usageCount === 1 ? 'movimento' : 'movimenti'}{authority.isSystemDefault ? ' · Predefinito' : ''}{!authority.isActive ? ' · Archiviato' : ''}</span></div>
        <div className="settings-entity-actions"><form action={toggleAction}><input type="hidden" name="id" value={authority.id}/><button className="btn btn-xs btn-default" type="submit"><span className="btn-icon" aria-hidden="true">{authority.isActive ? '▣' : '↥'}</span> {authority.isActive ? 'Archivia' : 'Ripristina'}</button></form><button className="btn btn-xs btn-primary" type="button" onClick={() => setEditing(authority)}><span className="btn-icon" aria-hidden="true">✎</span> Modifica</button></div>
      </article>)}</div>
    </section>{modal}
  </>;
}
