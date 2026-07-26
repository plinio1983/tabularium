import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureWorkspaceDefaults, incomeEntityIconOptions } from '@/lib/workspace-defaults';
import IncomeEntityCreatePanel from './IncomeEntityCreatePanel';
import IncomeEntityDeleteForm from './IncomeEntityDeleteForm';
import {
  createIncomeEntityAction,
  deleteIncomeEntityAction,
  updateCashRegisterIncomeDefaultsAction,
  updateIncomeEntityAction
} from './actions';

const errors: Record<string, string> = {
  invalid: 'Compila correttamente tutti i campi.',
  code_format: 'Il codice può contenere fino a 40 lettere, numeri e underscore.',
  icon_invalid: 'Seleziona un’icona valida.',
  code_exists: 'Esiste già un’entità con questo codice.',
  not_found: 'Entità non trovata.',
  in_use: 'Entità usata da incassi esistenti: riassegnali prima di rimuoverla.',
  cash_register_in_use: 'Entità configurata nel registratore di cassa: seleziona prima un altro valore.'
};

function EntitySection({ title, kind, entities }: {
  title: string;
  kind: 'category' | 'channel';
  entities: Array<{ id: number; code: string; name: string; icon: string | null; sortOrder?: number; _count: { incomes: number } }>;
}) {
  return <div className="income-entity-settings-section">
    <h3>{title}</h3>
    <IncomeEntityCreatePanel action={createIncomeEntityAction} kind={kind} iconOptions={incomeEntityIconOptions} />
    <div className="card categories-settings-card">
      <div className="categories-settings-table-head"><span>Nome</span><span>Codice</span><span>Icona</span><span>Uso</span><span>Azioni</span></div>
      {entities.map(entity => <div className="category-settings-row" key={entity.id}>
        <form action={updateIncomeEntityAction} className="category-settings-edit-form">
          <input type="hidden" name="id" value={entity.id} /><input type="hidden" name="kind" value={kind} />
          <label><span>Nome</span><input name="name" defaultValue={entity.name} maxLength={80} required /></label>
          <label><span>Codice stabile</span><input name="code" defaultValue={entity.code} maxLength={40} readOnly required /></label>
          <div className="span-2 category-settings-usage-wrap">
            <label><span>Icona</span><select name="icon" defaultValue={entity.icon ?? ''}><option value="">Nessuna</option>{incomeEntityIconOptions.map(icon => <option key={icon} value={icon}>{icon}</option>)}</select></label>
            {kind === 'channel' ? <label className="channel-sort-order-label"><span>Ordine select</span><input name="sortOrder" type="number" min="0" max="9999" step="1" defaultValue={entity.sortOrder ?? 0} title="Ordine nelle select" aria-label={`Posizione di ${entity.name} nelle select`} /></label> : null}
            <div className="category-settings-usage"><strong>{entity._count.incomes}</strong><small>{entity._count.incomes === 1 ? 'incasso' : 'incassi'}</small></div>
          </div>
          <div className="category-settings-actions"><button className="btn btn-xs btn-primary" type="submit">✓ Salva</button></div>
        </form>
        <IncomeEntityDeleteForm id={entity.id} kind={kind} name={entity.name} action={deleteIncomeEntityAction} />
      </div>)}
    </div>
  </div>;
}

export const dynamic = 'force-dynamic';

export default async function IncomeCategoriesSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/categories/incomes');
  await ensureWorkspaceDefaults(current.workspace.id);
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const usage = Array.isArray(params.usage) ? params.usage[0] : params.usage;
  const [channels, workspaceSettings] = await Promise.all([
    prisma.incomeSalesChannel.findMany({ where: { workspaceId: current.workspace.id }, include: { _count: { select: { incomes: true } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.workspace.findUnique({
      where: { id: current.workspace.id },
      select: { cashRegisterSalesChannelId: true }
    })
  ]);
  return <div className="grid admin-page categories-settings-page">
    <div className="toolbar-card"><div><h2>Canali di vendita</h2><p className="muted">Gestisci i canali e la posizione con cui vengono mostrati nelle select. I valori più bassi compaiono per primi.</p></div></div>
    {saved ? <div className="form-summary full"><strong>Configurazione aggiornata.</strong></div> : null}
    {error ? <div className="inline-form-error full">{errors[error] ?? 'Impossibile aggiornare la configurazione.'}{error === 'in_use' && usage ? ` Incassi collegati: ${usage}.` : ''}</div> : null}
    <form action={updateCashRegisterIncomeDefaultsAction} className="card form cash-register-settings-form">
      <div>
        <h3>Registratore di cassa</h3>
        <p className="muted">Canale predefinito applicato agli incassi da banco.</p>
      </div>
      <label>Canale predefinito
        <select name="cashRegisterSalesChannelId" defaultValue={workspaceSettings?.cashRegisterSalesChannelId ?? ''} required>
          <option value="">Seleziona</option>
          {channels.map(channel => <option value={channel.id} key={channel.id}>{channel.icon ?? ''} {channel.name}</option>)}
        </select>
      </label>
      <button className="btn btn-sm btn-primary" type="submit">✓ Salva configurazione</button>
    </form>
    <EntitySection title="Canali di vendita" kind="channel" entities={channels} />
  </div>;
}
