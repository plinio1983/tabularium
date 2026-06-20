import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { categoryIconOptions, orderExpenseCategories } from '@/lib/workspace-defaults';
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from './actions';
import CategoryCreatePanel from './CategoryCreatePanel';
import CategoryDeleteForm from './CategoryDeleteForm';

const errorMessages: Record<string, string> = {
  invalid: 'Compila nome e acronimo.',
  code_length: 'L’acronimo deve essere lungo al massimo 5 caratteri.',
  code_format: 'L’acronimo può contenere solo lettere e numeri.',
  icon_invalid: 'Seleziona un’icona valida.',
  code_exists: 'Esiste già una categoria con questo acronimo.',
  not_found: 'Categoria non trovata.',
  in_use: 'Categoria usata da movimenti esistenti: riassegnali prima di rimuoverla.'
};

const savedMessages: Record<string, string> = {
  created: 'Categoria aggiunta.',
  updated: 'Categoria aggiornata.',
  deleted: 'Categoria rimossa.'
};

export const dynamic = 'force-dynamic';

export default async function CategoriesSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await getCurrentSession();
  if (!current?.workspace) redirect('/login?next=/settings/categories');

  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const usage = Array.isArray(params.usage) ? params.usage[0] : params.usage;

  const categories = orderExpenseCategories(await prisma.expenseCategory.findMany({
    where: { workspaceId: current.workspace.id },
    include: { _count: { select: { expenses: true, recurringExpenses: true } } },
    orderBy: { id: 'asc' }
  }));

  return <div className="grid admin-page categories-settings-page">
    <div className="toolbar-card">
      <div>
        <h2>Categorie</h2>
        <p className="muted">Gestisci categorie e acronimi usati da spese, filtri e report.</p>
      </div>
    </div>

    {saved ? <div className="form-summary full"><strong>{savedMessages[saved] ?? 'Categorie aggiornate.'}</strong></div> : null}
    {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare le categorie.'}{error === 'in_use' && usage ? <span> Movimenti collegati: {usage}.</span> : null}</div> : null}

    <CategoryCreatePanel action={createCategoryAction} iconOptions={categoryIconOptions} />

    <div className="card categories-settings-card">
      <div className="categories-settings-table-head">
        <span>Nome</span>
        <span>Acronimo</span>
        <span>Icona</span>
        <span>Uso</span>
        <span>Azioni</span>
      </div>
      {categories.length ? categories.map(category => {
        const usageCount = category._count.expenses + category._count.recurringExpenses;
        return <div className="category-settings-row" key={category.id}>
          <form action={updateCategoryAction} className="category-settings-edit-form">
            <input type="hidden" name="id" value={category.id} />
            <label><span>Nome</span><input name="name" defaultValue={category.name} maxLength={80} required /></label>
            <label><span>Acronimo</span><input name="code" defaultValue={category.code} maxLength={5} pattern="[A-Za-z0-9]{1,5}" required /></label>
            <div className="span-2 category-settings-usage-wrap">
              <label><span>Icona</span><select name="icon" defaultValue={category.icon ?? ''}>
                <option value="">Nessuna</option>
                {categoryIconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}
              </select></label>
              <div className="category-settings-usage">
                <strong>{usageCount}</strong>
                <small>{usageCount === 1 ? 'movimento' : 'movimenti'}</small>
              </div>
            </div>
            <div className="category-settings-actions">
              <button type="submit" className="table-action">Salva</button>
            </div>
          </form>
          <CategoryDeleteForm id={category.id} name={category.name} action={deleteCategoryAction} />
        </div>;
      }) : <p className="muted">Nessuna categoria configurata.</p>}
    </div>
  </div>;
}
