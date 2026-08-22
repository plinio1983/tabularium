import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { categoryIconOptions, defaultExpenseCategoryCode, orderExpenseCategories } from '@/lib/workspace-defaults';
import { createCategoryAction, deleteCategoryAction, setVatSettlementCategoryAction, updateCategoryAction } from '../actions';
import CategoryCreatePanel from '../CategoryCreatePanel';
import ExpenseCategoryList from './ExpenseCategoryList';
import DetailBackButton from '@/components/DetailBackButton';

const errorMessages: Record<string, string> = {
  invalid: 'Compila nome e acronimo.',
  code_length: 'L’acronimo deve essere lungo al massimo 5 caratteri.',
  code_format: 'L’acronimo può contenere solo lettere e numeri.',
  icon_invalid: 'Seleziona un’icona valida.',
  code_exists: 'Esiste già una categoria con questo acronimo.',
  not_found: 'Categoria non trovata.',
  in_use: 'Categoria usata da movimenti esistenti: riassegnali prima di rimuoverla.',
  vat_settlement_category: 'Questa categoria è configurata per le spese Saldo IVA. Selezionane prima un’altra.',
  default_category_protected: 'La categoria Predefinita è una categoria di sistema e non può essere eliminata o privata del suo acronimo.'
};

const savedMessages: Record<string, string> = {
  created: 'Categoria aggiunta.',
  updated: 'Categoria aggiornata.',
  deleted: 'Categoria rimossa.',
  vat_settlement_category: 'Categoria Saldo IVA aggiornata.'
};

export const dynamic = 'force-dynamic';

export default async function ExpenseCategoriesSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/categories/expenses');
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const usage = Array.isArray(params.usage) ? params.usage[0] : params.usage;
  const [categoryRecords, workspace] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { workspaceId: current.workspace.id },
      include: { _count: { select: { expenses: true, recurringExpenses: true } } },
      orderBy: { id: 'asc' }
    }),
    prisma.workspace.findUnique({ where: { id: current.workspace.id }, select: { vatSettlementCategoryId: true } })
  ]);
  const categories = orderExpenseCategories(categoryRecords);

  return <div className="grid admin-page settings-admin-page categories-settings-page">
    <div className="toolbar-card">
      <div><h2>Categorie di spesa</h2><p className="muted">Gestisci categorie, acronimi e icone usati da spese, filtri e report.</p></div>
      <DetailBackButton href="/settings"/>
    </div>
    {saved ? <div className="form-summary full"><strong>{savedMessages[saved] ?? 'Categorie aggiornate.'}</strong></div> : null}
    {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare le categorie.'}{error === 'in_use' && usage ? <span> Movimenti collegati: {usage}.</span> : null}</div> : null}
    <CategoryCreatePanel action={createCategoryAction} iconOptions={categoryIconOptions} />
    <ExpenseCategoryList
      categories={categories.map(category => ({
        id: category.id,
        name: category.name,
        code: category.code,
        icon: category.icon,
        usageCount: category._count.expenses + category._count.recurringExpenses,
        protected: category.code === defaultExpenseCategoryCode
      }))}
      iconOptions={categoryIconOptions}
      updateAction={updateCategoryAction}
      deleteAction={deleteCategoryAction}
    />
    <form action={setVatSettlementCategoryAction} className="card form vat-settlement-category-setting vat-settlement-category-card">
      <div className="vat-settlement-category-title">
        <span className="vat-settlement-category-icon" aria-hidden="true">%</span>
        <div>
          <h3>Categoria Saldo IVA</h3>
          <p className="muted">Categoria assegnata automaticamente alle spese che registrano un versamento IVA.</p>
        </div>
      </div>
      <div className="app-form-field vat-settlement-category-field">
        <label className="app-form-field-label" htmlFor="vat-settlement-category">
          <span className="app-form-field-icon" aria-hidden="true">🏷</span>
          <span>Categoria predefinita</span>
        </label>
        <div className="app-select-control">
          <select id="vat-settlement-category" name="categoryId" defaultValue={workspace?.vatSettlementCategoryId ?? ''} required>
            <option value="" disabled>Seleziona una categoria</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}
          </select>
          <span className="app-select-caret" aria-hidden="true">⌄</span>
        </div>
        <small className="app-form-field-hint">Verrà applicata automaticamente alle nuove spese di tipo Saldo IVA.</small>
      </div>
      <div className="actions-row vat-settlement-category-actions">
        <button className="btn btn-md btn-primary" type="submit"><span className="btn-icon">✓</span> Salva configurazione</button>
      </div>
    </form>
  </div>;
}
