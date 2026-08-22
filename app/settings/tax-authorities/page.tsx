import {requireWorkspaceRole, workspaceManagementRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ensureWorkspaceDefaults, orderExpenseCategories} from '@/lib/workspace-defaults';
import DetailBackButton from '@/components/DetailBackButton';
import {saveTaxAuthorityAction, toggleTaxAuthorityAction} from './actions';
import TaxAuthorityManager from './TaxAuthorityManager';

export const dynamic = 'force-dynamic';

export default async function TaxAuthoritiesPage({searchParams}: {searchParams?: Promise<Record<string,string|string[]|undefined>>}) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/tax-authorities');
  await ensureWorkspaceDefaults(current.workspace.id);
  const params = await searchParams ?? {};
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const [authorities, categoryRecords] = await Promise.all([
    prisma.taxAuthority.findMany({where: {workspaceId: current.workspace.id}, include: {_count: {select: {expenses: true}}}, orderBy: [{isActive: 'desc'}, {name: 'asc'}]}),
    prisma.expenseCategory.findMany({where: {workspaceId: current.workspace.id}})
  ]);
  const categories = orderExpenseCategories(categoryRecords);
  return <div className="grid admin-page settings-admin-page categories-settings-page tax-authorities-settings-page">
    <div className="toolbar-card"><div><h2>Enti fiscali e previdenziali</h2><p className="muted">Gestisci i beneficiari disponibili nelle spese di tipo Imposte.</p></div><DetailBackButton href="/settings"/></div>
    {saved ? <div className="form-summary full"><strong>Anagrafica aggiornata.</strong></div> : null}
    {error ? <div className="inline-form-error full">{error === 'duplicate' ? 'Esiste già un ente con questo nome.' : 'Controlla i dati inseriti.'}</div> : null}
    <TaxAuthorityManager authorities={authorities.map(authority => ({
      id: authority.id, name: authority.name, kind: authority.kind,
      defaultDescription: authority.defaultDescription,
      defaultExpenseCategoryId: authority.defaultExpenseCategoryId,
      iban: authority.iban, notes: authority.notes, isActive: authority.isActive,
      isSystemDefault: authority.isSystemDefault, usageCount: authority._count.expenses
    }))} categories={categories.map(category => ({id: category.id, name: category.name, icon: category.icon}))} saveAction={saveTaxAuthorityAction} toggleAction={toggleTaxAuthorityAction}/>
  </div>;
}
