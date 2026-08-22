import {requireWorkspaceRole, workspaceManagementRoles} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ensureWorkspaceDefaults, incomeEntityIconOptions} from '@/lib/workspace-defaults';
import IncomeEntityCreatePanel from './IncomeEntityCreatePanel';
import IncomeSalesChannelGrid from './IncomeSalesChannelGrid';
import {
    createIncomeEntityAction,
    deleteIncomeEntityAction,
    updateCashRegisterIncomeDefaultsAction,
    updateIncomeEntityAction
} from './actions';
import DetailBackButton from '@/components/DetailBackButton';

const errors: Record<string, string> = {
    invalid: 'Compila correttamente tutti i campi.',
    icon_invalid: 'Seleziona un’icona valida.',
    not_found: 'Entità non trovata.',
    in_use: 'Entità usata da incassi esistenti: riassegnali prima di rimuoverla.',
    cash_register_in_use: 'Entità configurata nel registratore di cassa: seleziona prima un altro valore.',
    fallback_delete: 'Il canale di fallback Predefinito non può essere eliminato.'
};

function EntitySection({title, kind, entities}: {
    title: string;
    kind: 'channel';
    entities: Array<{
        id: number;
        code: string;
        name: string;
        icon: string | null;
        sortOrder?: number;
        isDefault?: boolean;
        isFallback?: boolean;
        _count: { incomes: number }
    }>;
}) {
    return <div className="income-entity-settings-section">
        <IncomeEntityCreatePanel action={createIncomeEntityAction} kind={kind} iconOptions={incomeEntityIconOptions}/>
        <IncomeSalesChannelGrid
            channels={entities.map(entity => ({...entity, sortOrder: entity.sortOrder ?? 0}))}
            iconOptions={incomeEntityIconOptions}
            updateAction={updateIncomeEntityAction}
            deleteAction={deleteIncomeEntityAction}
        />
    </div>;
}

export const dynamic = 'force-dynamic';

export default async function IncomeCategoriesSettingsPage({searchParams}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/categories/incomes');
    await ensureWorkspaceDefaults(current.workspace.id);
    const params = (await searchParams) ?? {};
    const error = Array.isArray(params.error) ? params.error[0] : params.error;
    const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
    const usage = Array.isArray(params.usage) ? params.usage[0] : params.usage;
    const [channels, workspaceSettings] = await Promise.all([
        prisma.incomeSalesChannel.findMany({
            where: {workspaceId: current.workspace.id},
            include: {_count: {select: {incomes: true}}},
            orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]
        }),
        prisma.workspace.findUnique({
            where: {id: current.workspace.id},
            select: {cashRegisterSalesChannelId: true}
        })
    ]);
    return <div className="grid admin-page settings-admin-page categories-settings-page">
        <div className="toolbar-card">
            <div><h2>Canali di vendita</h2>
                <p className="muted">Gestisci i canali e la posizione con cui vengono mostrati nelle select. I valori più bassi compaiono per primi.</p>
            </div>
            <DetailBackButton href="/settings"/></div>
        {saved ? <div className="form-summary full"><strong>Configurazione aggiornata.</strong></div> : null}
        {error ?
            <div className="inline-form-error full">{errors[error] ?? 'Impossibile aggiornare la configurazione.'}{error === 'in_use' && usage ? ` Incassi collegati: ${usage}.` : ''}</div> : null}
        <EntitySection title="Canali di vendita" kind="channel" entities={channels}/>
        <form action={updateCashRegisterIncomeDefaultsAction} className="card form cash-register-settings-form sales-channel-register-card">
            <div className="sales-channel-register-title">
                <span className="vat-settlement-category-icon" aria-hidden="true">▣</span>
                <div>
                    <h3>Registratore di cassa</h3>
                    <p className="muted">Canale predefinito applicato agli incassi da banco.</p>
                </div>
            </div>
            <label className="app-form-field">Canale predefinito
                <select name="cashRegisterSalesChannelId" defaultValue={workspaceSettings?.cashRegisterSalesChannelId ?? ''} required>
                    <option value="">Seleziona</option>
                    {channels.map(channel =>
                        <option value={channel.id} key={channel.id}>{channel.icon ?? ''} {channel.name}</option>)}
                </select>
            </label>
            <button className="btn btn-md btn-primary" type="submit">✓ Salva configurazione</button>
        </form>
    </div>;
}
