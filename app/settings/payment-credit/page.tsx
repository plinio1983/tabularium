import { requireWorkspaceRole, workspaceManagementRoles } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureWorkspaceDefaults, orderBanks, orderPaymentMethods, paymentCreditIconOptions } from '@/lib/workspace-defaults';
import {
  createBankAction,
  createPaymentMethodAction,
  deleteBankAction,
  deletePaymentMethodAction,
  updateCashRegisterBankRulesAction,
  updateBankAction,
  updatePaymentMethodAction
} from './actions';
import PaymentCreditCreatePanel from './PaymentCreditCreatePanel';
import PaymentCreditEditRow from './PaymentCreditEditRow';
import Link from 'next/link';
import DetailBackButton from '@/components/DetailBackButton';

const errorMessages: Record<string, string> = {
  invalid: 'Compila correttamente i campi richiesti.',
  name_length: 'La label deve essere lunga al massimo 80 caratteri.',
  kind_invalid: 'Seleziona un uso valido.',
  icon_invalid: 'Seleziona un’icona valida.',
  bank_exists: 'Esiste già una banca/canale accredito con questa label.',
  bank_not_found: 'Banca/canale accredito non trovato.',
  method_exists: 'Esiste già un metodo con questa label.',
  method_not_found: 'Metodo non trovato.',
  cash_register_invalid: 'Abilita almeno un metodo e seleziona il metodo principale.',
  cash_register_bank: 'Imposta una banca valida per ogni metodo del registratore.',
  cash_register_rule_bank: 'Seleziona una banca valida per ogni combinazione di metodo e canale.',
  cash_register_method_delete: 'Disabilita o sostituisci il metodo nel registratore prima di eliminarlo.',
  cash_bank_delete: 'Il canale di sistema Cassa non può essere eliminato.',
  cash_bank_primary: 'Il canale di sistema Cassa non può essere impostato come banca principale.',
  fallback_delete: 'Il valore generico non può essere eliminato, ma puoi modificarne la label.',
  system_delete: 'Il metodo di pagamento di sistema non può essere eliminato, ma puoi modificarne la label.',
  in_use: 'Valore usato da movimenti esistenti: riassegnali prima di rimuoverlo.'
};

const savedMessages: Record<string, string> = {
  bank_created: 'Banca/canale accredito aggiunto.',
  bank_updated: 'Banca/canale accredito aggiornato.',
  bank_deleted: 'Banca/canale accredito rimosso.',
  method_created: 'Metodo aggiunto.',
  method_updated: 'Metodo aggiornato.',
  method_deleted: 'Metodo rimosso.',
  cash_register_updated: 'Metodi del registratore di cassa aggiornati.',
  cash_register_rules_updated: 'Instradamento degli accrediti aggiornato.'
};

const kindLabels: Record<string, string> = {
  INCOME: 'Incassi',
  EXPENSE: 'Spese',
  BOTH: 'Entrambi'
};

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = 'force-dynamic';

export default async function PaymentCreditSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspaceRole(workspaceManagementRoles, '/settings/payment-credit');
  await ensureWorkspaceDefaults(current.workspace.id);

  const params = (await searchParams) ?? {};
  const error = paramValue(params, 'error');
  const saved = paramValue(params, 'saved');
  const usage = paramValue(params, 'usage');
  const requestedSection = paramValue(params, 'section');
  const section = requestedSection === 'banks' || requestedSection === 'methods' || requestedSection === 'routing'
    ? requestedSection
    : null;
  const sectionTitles = {
    banks: 'Banche e canali di accredito',
    methods: 'Metodi di pagamento e accredito',
    routing: 'Instradamento registratore di cassa'
  } as const;

  const [banks, paymentMethods, workspaceSettings, salesChannels, bankRules] = await Promise.all([
    prisma.bank.findMany({
      where: { workspaceId: current.workspace.id },
      include: { _count: { select: { payments: true, recurringExpenses: true, incomeLegacyCredits: true, incomeCredits: true, cashRegisterBankRules: true } } },
      orderBy: { id: 'asc' }
    }),
    prisma.paymentMethod.findMany({
      where: { workspaceId: current.workspace.id },
      include: { _count: { select: { incomePayments: true, expensePayments: true, recurringExpenses: true } } },
      orderBy: { id: 'asc' }
    }),
    prisma.workspace.findUnique({
      where: { id: current.workspace.id },
      select: { cashRegisterPrimaryPaymentMethodId: true }
    }),
    prisma.incomeSalesChannel.findMany({
      where: { workspaceId: current.workspace.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    }),
    prisma.cashRegisterBankRule.findMany({
      where: { workspaceId: current.workspace.id }
    })
  ]);

  const orderedBanks = orderBanks(banks);
  const orderedMethods = orderPaymentMethods(paymentMethods);
  const routedMethods = orderedMethods.filter(method =>
    method.cashRegisterEnabled
    && method.systemRole !== 'CASH'
    && (method.kind === 'INCOME' || method.kind === 'BOTH')
  );
  const ruleBank = new Map(bankRules.map(rule => [`${rule.paymentMethodId}_${rule.salesChannelId}`, rule.bankId]));

  return <div className="grid admin-page categories-settings-page">
    <div className="toolbar-card">
      <div>
        <h2>{section ? sectionTitles[section] : 'Pagamento e Accredito'}</h2>
        <p className="muted">{section
          ? 'Configura i valori utilizzati nei movimenti e nel registratore di cassa.'
          : 'Seleziona la categoria di impostazioni da visualizzare.'}</p>
      </div>
      <DetailBackButton href={section ? "/settings/payment-credit" : "/settings"} />
    </div>

    {saved ? <div className="form-summary full"><strong>{savedMessages[saved] ?? 'Configurazione aggiornata.'}</strong></div> : null}
    {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare la configurazione.'}{error === 'in_use' && usage ? <span> Movimenti collegati: {usage}.</span> : null}</div> : null}

    {!section ? <nav className="settings-category-hub" aria-label="Sezioni Pagamento e Accredito">
      <Link className="card settings-category-link" href="/settings/payment-credit?section=banks">
        <span className="settings-category-link-icon" aria-hidden="true">▥</span>
        <span><strong>Banche e canali di accredito</strong><small>Gestisci banche e conti usati per accrediti e pagamenti.</small></span>
      </Link>
      <Link className="card settings-category-link" href="/settings/payment-credit?section=methods">
        <span className="settings-category-link-icon" aria-hidden="true">▣</span>
        <span><strong>Metodi di pagamento e accredito</strong><small>Configura i metodi disponibili nei movimenti e nel registratore.</small></span>
      </Link>
      <Link className="card settings-category-link" href="/settings/payment-credit?section=routing">
        <span className="settings-category-link-icon" aria-hidden="true">⇄</span>
        <span><strong>Instradamento registratore di cassa</strong><small>Associa una banca a ogni coppia metodo e canale di vendita.</small></span>
      </Link>
    </nav> : null}

    {section === 'banks' ? <>
    <PaymentCreditCreatePanel action={createBankAction} type="bank" iconOptions={paymentCreditIconOptions} />
    <section className="card expense-category-list-card payment-credit-settings-card payment-banks-list-card">
      <div className="expense-category-list-heading">
        <div>
          <h3>Banche e canali configurati</h3>
          <p className="muted">{orderedBanks.length} {orderedBanks.length === 1 ? 'elemento' : 'elementi'}</p>
        </div>
      </div>
      <div className="expense-category-settings-list payment-banks-settings-list">
      {orderedBanks.length ? orderedBanks.map(bank => {
        const usageCount = bank._count.payments + bank._count.recurringExpenses + bank._count.incomeLegacyCredits + bank._count.incomeCredits + bank._count.cashRegisterBankRules;
        return <PaymentCreditEditRow key={bank.id} id={bank.id} name={bank.name} icon={bank.icon} kindLabel={bank.isFallback ? 'Canale' : 'Banca'} primary={!bank.isFallback && current.company.primaryBankId === bank.id} canBePrimary={!bank.isFallback} usageCount={usageCount} protectedFromDelete={bank.isFallback} iconOptions={paymentCreditIconOptions} updateAction={updateBankAction} deleteAction={deleteBankAction} />;
      }) : <p className="muted">Nessuna banca configurata.</p>}
      </div>
    </section>
    </> : null}

    {section === 'methods' ? <>
    <PaymentCreditCreatePanel action={createPaymentMethodAction} type="method" iconOptions={paymentCreditIconOptions} />
    <section className="card expense-category-list-card payment-credit-settings-card payment-methods-list-card">
      <div className="expense-category-list-heading">
        <div>
          <h3>Metodi configurati</h3>
          <p className="muted">{orderedMethods.length} {orderedMethods.length === 1 ? 'metodo' : 'metodi'}</p>
        </div>
      </div>
      <div className="expense-category-settings-list payment-methods-settings-list">
      {orderedMethods.length ? orderedMethods.map(method => {
        const usageCount = method._count.incomePayments + method._count.expensePayments + method._count.recurringExpenses;
        const eligibleForCashRegister = method.kind === 'INCOME' || method.kind === 'BOTH';
        return <PaymentCreditEditRow key={method.id} id={method.id} name={method.name} icon={method.icon} kind={method.kind} kindLabel={method.isFallback ? 'Generico' : kindLabels[method.kind] ?? method.kind} usageCount={usageCount} protectedFromDelete={method.isFallback || Boolean(method.systemRole)} iconOptions={paymentCreditIconOptions} updateAction={updatePaymentMethodAction} deleteAction={deletePaymentMethodAction}
          isExpenseDefault={method.isExpenseDefault}
          isIncomeDefault={method.isIncomeDefault}
          cashRegister={eligibleForCashRegister ? {
            enabled: method.cashRegisterEnabled,
            defaultBankId: method.cashRegisterDefaultBankId,
            primary: workspaceSettings?.cashRegisterPrimaryPaymentMethodId === method.id,
            cash: method.systemRole === 'CASH',
            banks: orderedBanks.map(bank => ({id: bank.id, name: bank.name, icon: bank.icon, isPrimary: current.company.primaryBankId === bank.id}))
          } : undefined}/>;
      }) : <p className="muted">Nessun metodo configurato.</p>}
      </div>
    </section>
    </> : null}

    {section === 'routing' ?
    <details className="card categories-settings-card payment-credit-settings-card payment-credit-collapsible cash-register-routing-card" open>
      <summary className="category-create-toggle">
        <span>Instradamento accrediti registratore</span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className="cash-register-routing-content">
        <p className="muted">Scegli la banca di accredito per ogni combinazione tra metodo di pagamento e canale di vendita. Cash resta sempre associato a Cassa.</p>
        {routedMethods.length && salesChannels.length ? <form action={updateCashRegisterBankRulesAction}>
          <div className="table-scroll">
            <table className="cash-register-routing-table">
              <thead>
                <tr>
                  <th>Metodo</th>
                  {salesChannels.map(channel => <th key={channel.id}>{channel.icon ?? ''} {channel.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {routedMethods.map(method => <tr key={method.id}>
                  <th>{method.icon ?? ''} {method.name}</th>
                  {salesChannels.map(channel => {
                    const selectedBankId = ruleBank.get(`${method.id}_${channel.id}`)
                      ?? method.cashRegisterDefaultBankId
                      ?? current.company.primaryBankId
                      ?? '';
                    return <td key={channel.id} data-channel={`${channel.icon ?? ''} ${channel.name}`.trim()}>
                      <label>
                        <span className="sr-only">{method.name} · {channel.name}</span>
                        <select name={`rule_${method.id}_${channel.id}`} defaultValue={selectedBankId} required>
                          <option value="">Seleziona banca</option>
                          {orderedBanks.map(bank => <option key={bank.id} value={bank.id}>{bank.icon ?? ''} {bank.name}</option>)}
                        </select>
                      </label>
                    </td>;
                  })}
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="cash-register-routing-actions">
            <button className="btn btn-sm btn-primary" type="submit">✓ Salva instradamento</button>
          </div>
        </form> : <p className="muted">Abilita almeno un metodo non Cash nel registratore e configura un canale di vendita.</p>}
      </div>
    </details>
    : null}
  </div>;
}
