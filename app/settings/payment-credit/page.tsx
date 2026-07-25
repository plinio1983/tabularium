import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureWorkspaceDefaults, orderBanks, orderPaymentMethods, paymentCreditIconOptions } from '@/lib/workspace-defaults';
import {
  createBankAction,
  createPaymentMethodAction,
  deleteBankAction,
  deletePaymentMethodAction,
  updateBankAction,
  updatePaymentMethodAction
} from './actions';
import PaymentCreditCreatePanel from './PaymentCreditCreatePanel';
import PaymentCreditEditRow from './PaymentCreditEditRow';

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
  cash_register_method_delete: 'Disabilita o sostituisci il metodo nel registratore prima di eliminarlo.',
  cash_bank_delete: 'Il canale di sistema Cassa non può essere eliminato.',
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
  cash_register_updated: 'Metodi del registratore di cassa aggiornati.'
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
  const current = await getCurrentSession();
  if (!current?.workspace) redirect('/login?next=/settings/payment-credit');
  await ensureWorkspaceDefaults(current.workspace.id);

  const params = (await searchParams) ?? {};
  const error = paramValue(params, 'error');
  const saved = paramValue(params, 'saved');
  const usage = paramValue(params, 'usage');

  const [banks, paymentMethods, workspaceSettings] = await Promise.all([
    prisma.bank.findMany({
      where: { workspaceId: current.workspace.id },
      include: { _count: { select: { payments: true, recurringExpenses: true, incomeCredits: true } } },
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
    })
  ]);

  const orderedBanks = orderBanks(banks);
  const orderedMethods = orderPaymentMethods(paymentMethods);

  return <div className="grid admin-page categories-settings-page">
    <div className="toolbar-card">
      <div>
        <h2>Pagamento e Accredito</h2>
        <p className="muted">Gestisci banche, canali accredito e metodi usati da spese e incassi.</p>
      </div>
    </div>

    {saved ? <div className="form-summary full"><strong>{savedMessages[saved] ?? 'Configurazione aggiornata.'}</strong></div> : null}
    {error ? <div className="inline-form-error full">{errorMessages[error] ?? 'Impossibile aggiornare la configurazione.'}{error === 'in_use' && usage ? <span> Movimenti collegati: {usage}.</span> : null}</div> : null}

    <PaymentCreditCreatePanel action={createBankAction} type="bank" iconOptions={paymentCreditIconOptions} />

    <details className="card categories-settings-card payment-credit-settings-card payment-credit-collapsible" open>
      <summary className="category-create-toggle">
        <span>Banche / canali accredito</span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className="categories-settings-table-head payment-credit-table-head">
        <span>Label</span>
        <span>Icona</span>
        <span>Tipo</span>
        <span>Uso</span>
        <span>Azioni</span>
      </div>
      {orderedBanks.length ? orderedBanks.map(bank => {
                const usageCount = bank._count.payments + bank._count.recurringExpenses + bank._count.incomeCredits;
        return <PaymentCreditEditRow key={bank.id} id={bank.id} name={bank.name} icon={bank.icon} kindLabel={bank.isFallback ? 'Canale' : 'Banca'} usageCount={usageCount} protectedFromDelete={bank.isFallback} iconOptions={paymentCreditIconOptions} updateAction={updateBankAction} deleteAction={deleteBankAction} />;
      }) : <p className="muted">Nessuna banca configurata.</p>}
    </details>

    <PaymentCreditCreatePanel action={createPaymentMethodAction} type="method" iconOptions={paymentCreditIconOptions} />

    <details className="card categories-settings-card payment-credit-settings-card payment-credit-collapsible" open>
      <summary className="category-create-toggle">
        <span>Metodi pagamento/accredito</span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className="categories-settings-table-head payment-credit-table-head">
        <span>Label</span>
        <span>Icona</span>
        <span>Uso</span>
        <span>Movimenti</span>
        <span>Azioni</span>
      </div>
      {orderedMethods.length ? orderedMethods.map(method => {
        const usageCount = method._count.incomePayments + method._count.expensePayments + method._count.recurringExpenses;
        const eligibleForCashRegister = method.kind === 'INCOME' || method.kind === 'BOTH';
        return <PaymentCreditEditRow key={method.id} id={method.id} name={method.name} icon={method.icon} kind={method.kind} kindLabel={method.isFallback ? 'Generico' : kindLabels[method.kind] ?? method.kind} usageCount={usageCount} protectedFromDelete={method.isFallback || Boolean(method.systemRole)} iconOptions={paymentCreditIconOptions} updateAction={updatePaymentMethodAction} deleteAction={deletePaymentMethodAction}
          cashRegister={eligibleForCashRegister ? {
            enabled: method.cashRegisterEnabled,
            defaultBankId: method.cashRegisterDefaultBankId,
            primary: workspaceSettings?.cashRegisterPrimaryPaymentMethodId === method.id,
            cash: method.systemRole === 'CASH',
            banks: orderedBanks.map(bank => ({id: bank.id, name: bank.name, icon: bank.icon}))
          } : undefined}/>;
      }) : <p className="muted">Nessun metodo configurato.</p>}
    </details>
  </div>;
}
