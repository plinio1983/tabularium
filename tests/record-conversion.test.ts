import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as rules from '../lib/record-conversion';
import * as payroll from '../lib/payroll-expense';
import * as companyTime from '../lib/company-time';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../lib/record-conversion-service.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText;

type RecordData = Record<string, any>;
function expense(): RecordData {
    return {id: 10, workspaceId: 1, companyId: 2, expenseType: 'STANDARD', isRecurring: false, recurringExpenseId: null,
        amount: '100', paidAmount: '20', payments: [{id: 31, amount: '20', bankId: 3, paymentMethodId: 4, paymentDate: new Date('2026-09-10')}],
        attachments: [{id: 40, type: 'INVOICE', path: '/existing.pdf'}], merchant: 'Fornitore', supplierId: 5,
        payrollNetAmount: null, payrollExtraCompensation: null, payrollGrossAmount: null, payrollEmployerCost: null,
        payrollPeriodStart: null, payrollPeriodEnd: null, updatedAt: new Date('2026-09-01'), month: 9, year: 2026};
}
function income(): RecordData {
    return {id: 10, workspaceId: 1, companyId: 2, incomeType: 'STANDARD', recurringIncomeId: null,
        amount: '100', isCredited: true, credits: [{id: 32, amount: '100', bankId: 3, paymentMethodId: 4, creditDate: new Date('2026-09-10')}],
        attachments: [{id: 40, type: 'DOCUMENT', path: '/existing.pdf'}], customerId: 5, salesChannelId: 8,
        billingMonth: 9, billingYear: 2026, updatedAt: new Date('2026-09-01')};
}
function setup(source = expense(), options: {denied?: boolean; missing?: boolean; missingEntity?: boolean; auditFails?: boolean; methodDisabled?: boolean; wrongBank?: boolean} = {}) {
    const updates: RecordData[] = [], audits: RecordData[] = [];
    const whereCalls: RecordData[] = [];
    const tx = {
        expense: {findFirst: async ({where}: RecordData) => {whereCalls.push(where); return options.missing ? null : source;}, update: async (args: RecordData) => {updates.push(args); return args;}},
        income: {findFirst: async ({where}: RecordData) => {whereCalls.push(where); return options.missing ? null : source;}, update: async (args: RecordData) => {updates.push(args); return args;}},
        company: {findFirst: async () => ({timeZone: 'Europe/Rome'})},
        employee: {findFirst: async ({where}: RecordData) => {whereCalls.push(where); return options.missingEntity ? null : {id: 7, firstName: 'Mario', lastName: 'Rossi'};}},
        taxAuthority: {findFirst: async () => options.missingEntity ? null : {id: 9, name: 'Erario'}},
        supplier: {findFirst: async () => options.missingEntity ? null : {id: 5, businessName: 'Fornitore'}},
        expenseCategory: {findFirst: async () => ({id: 6, name: 'Generica'})},
        incomeSalesChannel: {findFirst: async () => ({id: 8, name: 'Negozio'})},
        customer: {findFirst: async ({where}: RecordData) => options.missingEntity ? null : {id: where.id ?? 6, businessName: 'Cliente'}},
        incomeCategory: {findFirst: async () => ({id: 6, name: 'Generica'})},
        paymentMethod: {findFirst: async () => options.methodDisabled ? null : {id: 4, name: 'Contanti', systemRole: 'CASH', cashRegisterDefaultBankId: options.wrongBank ? 999 : 3}},
        bank: {findFirst: async () => ({id: 3, name: 'Cassa'})},
        cashRegisterBankRule: {findFirst: async () => null},
        auditLog: {create: async (args: RecordData) => {if (options.auditFails) throw new Error('audit failed'); audits.push(args);}}
    };
    let transactions = 0;
    const prisma = {$transaction: async (callback: (tx: unknown) => unknown, config: RecordData) => {
        transactions++;
        assert.equal(config.isolationLevel, 'Serializable');
        try {return await callback(tx);} catch (error) {updates.length = 0; audits.length = 0; throw error;}
    }};
    const exports: RecordData = {};
    const mocks: RecordData = {
        '@/lib/prisma': {prisma}, '@/lib/auth': {workspaceOperationalRoles: ['OWNER', 'ADMIN', 'ACCOUNTANT'], getWorkspaceApiAccess: async () => options.denied ? {ok: false, status: 403, error: 'Permessi insufficienti'} : {ok: true, current: {workspace: {id: 1}, company: {id: 2, timeZone: 'Europe/Rome'}, user: {id: 3}}}},
        '@/lib/payroll-expense': payroll, '@/lib/record-conversion': rules, '@/lib/company-time': companyTime
    };
    runInNewContext(compiled, {exports, Date, Error, FormData, console: {error() {}}, require: (name: string) => mocks[name] ?? require(name)});
    return {source, updates, audits, whereCalls, transactions: () => transactions,
        snapshot: () => exports.conversionSnapshot(source),
        send: async (fields: RecordData, kind: 'expenses' | 'incomes' = 'expenses') => {
            const form = new FormData();
            Object.entries({snapshot: exports.conversionSnapshot(source), ...fields}).forEach(([key, value]) => form.set(key, String(value)));
            const response: Response = await exports.handleRecordConversion(kind, new Request('http://localhost/api/convert', {method: 'POST', body: form}), 10);
            return {status: response.status, body: await response.json()};
        }};
}
const payrollInput = {targetType: 'PAYROLL', amount: '100', payrollNetAmount: '80', payrollExtraCompensation: '20', payrollPeriodStart: '2026-09-01', payrollPeriodEnd: '2026-09-30', dueDate: '2026-10-10', billingPeriod: '2026-09', description: 'Busta paga', employeeId: '7', vatRate: '0'};
const cashInput = {targetType: 'CASH_REGISTER', amount: '100', salesChannelId: '8', isFiscal: 'true', vatRate: '22', description: 'Vendita'};

test('prefill mantiene i dati comuni, propone il netto e lascia da completare soggetto e periodo', () => {
    const result = rules.expenseConversionDefaults({...expense(), amount: '100', expenseType: 'STANDARD', employeeId: 77}, 'PAYROLL');
    assert.equal(result.amount, '100');
    assert.equal(result.payrollNetAmount, '100');
    assert.equal(result.employeeId, null);
    assert.equal(result.payrollPeriodStart, null);
    assert.equal(result.payrollExtraCompensation, 0);
    assert.equal(result.isDeclared, false);
});

test('anteprima senza scritture; conferma atomica mantiene ID, pagamenti e allegati', async () => {
    const h = setup();
    const preview = await h.send(payrollInput);
    assert.equal(preview.status, 200);
    assert.equal(h.updates.length, 0);
    assert.equal(h.audits.length, 0);
    assert.ok(preview.body.changes.some((change: RecordData) => change.after === 'Busta paga'));
    const result = await h.send({...payrollInput, confirmed: 'true', reviewToken: preview.body.reviewToken});
    assert.equal(result.status, 200);
    const {data, where} = h.updates[0];
    assert.equal(data.expenseType, 'PAYROLL');
    assert.equal(data.amount, 100);
    assert.equal(data.employeeId, 7);
    assert.equal(data.supplierId, null);
    assert.equal(data.paidAmount, 20);
    assert.equal(data.paymentStatus, 'PAGATO_PARZIALMENTE');
    assert.deepEqual(JSON.parse(JSON.stringify(where)), {id: 10, workspaceId: 1, companyId: 2});
    for (const field of ['payments', 'attachments', 'id', 'invoiceDocumentPath']) assert.equal(field in data, false);
    assert.equal(h.audits[0].data.metadata.operation, 'convert_type');
    assert.equal(h.audits[0].data.metadata.before.payments[0].id, 31);
    assert.equal(h.audits[0].data.metadata.after.attachments[0].id, 40);
    assert.ok(h.whereCalls.some(where => where.companyId === 2 && where.status === 'ACTIVE'));
});

test('blocca permessi mancanti, record fuori società e riferimenti non validi', async () => {
    const denied = setup(expense(), {denied: true});
    assert.equal((await denied.send(payrollInput)).status, 403);
    assert.equal(denied.transactions(), 0);
    assert.equal((await setup(expense(), {missing: true}).send(payrollInput)).status, 404);
    assert.equal((await setup(expense(), {missingEntity: true}).send(payrollInput)).status, 400);
});

test('blocca snapshot scaduto anche quando cambia solo un pagamento o allegato', async () => {
    for (const child of ['payments', 'attachments']) {
        const h = setup();
        const snapshot = h.snapshot();
        h.source[child][0].id++;
        assert.equal((await h.send({...payrollInput, snapshot})).status, 409);
        assert.equal(h.updates.length, 0);
    }
});

test('conferma richiede il riepilogo esatto, senza modifiche dopo anteprima', async () => {
    const h = setup();
    assert.equal((await h.send({...payrollInput, confirmed: 'true'})).status, 409);
    const preview = await h.send(payrollInput);
    assert.equal((await h.send({...payrollInput, notes: 'Modificato', confirmed: 'true', reviewToken: preview.body.reviewToken})).status, 409);
    assert.equal(h.updates.length, 0);
});

test('importo insufficiente, periodo errato e Saldo IVA non producono scritture', async () => {
    assert.equal((await setup().send({...payrollInput, payrollNetAmount: '10', payrollExtraCompensation: '0'})).status, 400);
    assert.equal((await setup().send({...payrollInput, payrollPeriodStart: '2026-09-31'})).status, 400);
    assert.equal((await setup({...expense(), expenseType: 'VAT_SETTLEMENT'}).send(payrollInput)).status, 400);
});

test('errore audit annulla la transazione', async () => {
    const h = setup(expense(), {auditFails: true});
    const preview = await h.send(payrollInput);
    assert.equal((await h.send({...payrollInput, confirmed: 'true', reviewToken: preview.body.reviewToken})).status, 500);
    assert.equal(h.updates.length, 0);
});

test('conversione in F24 e ritorno a spesa singola ripuliscono i campi specifici', async () => {
    const h = setup({...expense(), expenseType: 'PAYROLL', payrollNetAmount: '100', employeeId: 7});
    const input = {...payrollInput, targetType: 'TAX_CONTRIBUTION', taxAuthorityId: '9', affectsFiscalProfit: 'true'};
    const preview = await h.send(input);
    assert.equal(preview.status, 200);
    await h.send({...input, confirmed: 'true', reviewToken: preview.body.reviewToken});
    assert.equal(h.updates[0].data.payrollNetAmount, null);
    assert.equal(h.updates[0].data.employeeId, null);
    assert.equal(h.updates[0].data.taxAuthorityId, 9);
    assert.equal(h.updates[0].data.invoiceStatus, 'NON_PREVISTA');
    const single = {...input, targetType: 'STANDARD', supplierId: '5', isDeclared: 'true', vatRate: '22', invoiceStatus: 'IN_ATTESA'};
    const next = await h.send(single);
    await h.send({...single, confirmed: 'true', reviewToken: next.body.reviewToken});
    assert.equal(h.updates[1].data.supplierId, 5);
    assert.equal(h.updates[1].data.taxAuthorityId, null);
    assert.equal(h.updates[1].data.vatRate, 22);
});

test('scontrino conserva l’accredito e deriva data, conto e competenza senza nuovi movimenti', async () => {
    const h = setup(income());
    const preview = await h.send(cashInput, 'incomes');
    assert.equal(preview.status, 200);
    const result = await h.send({...cashInput, confirmed: 'true', reviewToken: preview.body.reviewToken}, 'incomes');
    assert.equal(result.status, 200);
    const data = h.updates[0].data;
    assert.equal(data.incomeType, 'CASH_REGISTER');
    assert.equal(data.isCredited, true);
    assert.equal(data.creditBankId, 3);
    assert.equal(data.billingMonth, 9);
    assert.equal('credits' in data, false);
    assert.equal('attachments' in data, false);
});

test('scontrino rifiuta accrediti parziali, multipli, metodo disabilitato e conto incompatibile', async () => {
    const partial = income(); partial.credits[0].amount = '50';
    assert.equal((await setup(partial).send(cashInput, 'incomes')).status, 400);
    const multiple = income(); multiple.credits.push({...multiple.credits[0], id: 33});
    assert.equal((await setup(multiple).send(cashInput, 'incomes')).status, 400);
    assert.equal((await setup(income(), {methodDisabled: true}).send(cashInput, 'incomes')).status, 400);
    assert.equal((await setup(income(), {wrongBank: true}).send(cashInput, 'incomes')).status, 400);
    assert.equal((await setup({...income(), credits: []}).send(cashInput, 'incomes')).status, 400);
});

test('scontrino → incasso singolo richiede cliente e mantiene gli accrediti', async () => {
    const h = setup({...income(), incomeType: 'CASH_REGISTER'});
    const input = {...cashInput, targetType: 'STANDARD', customerId: 5, orderDate: '2026-09-10', dueDate: '2026-09-10', billingPeriod: '2026-09'};
    const preview = await h.send(input, 'incomes');
    assert.equal(preview.status, 200);
    await h.send({...input, confirmed: 'true', reviewToken: preview.body.reviewToken}, 'incomes');
    assert.equal(h.updates[0].data.incomeType, 'STANDARD');
    assert.equal(h.updates[0].data.customerId, 5);
    assert.equal('credits' in h.updates[0].data, false);
    assert.equal((await h.send({...input, customerId: ''}, 'incomes')).status, 400);
});

const counterInput = {targetType: 'COUNTER', amount: '100', categoryId: '6', description: 'Acquisto', isDeclared: 'true', vatRate: '22', paymentDate: '2026-09-10T00:00:00.000Z', paymentMethodId: '4', bankId: '3'};
test('da banco: anteprima avvisa, conferma conserva il primo ID ed elimina solo i successivi', async () => {
    const source = expense();
    source.payments.push({...source.payments[0], id: 32, amount: '40'});
    const h = setup(source);
    const preview = await h.send(counterInput);
    assert.equal(preview.status, 200);
    assert.equal(h.updates.length, 0);
    assert.match(preview.body.warnings[0], /successivi al primo saranno eliminati/);
    assert.equal((await h.send({...counterInput, confirmed: true, reviewToken: preview.body.reviewToken})).status, 200);
    const data = h.updates[0].data;
    assert.equal(data.payments.update.where.id, 31);
    assert.equal(data.payments.update.data.amount, 100);
    assert.deepEqual([...data.payments.deleteMany.id.in], [32]);
    assert.equal(data.paidAmount, 100);
    assert.equal(data.paymentStatus, 'COMPLETATO');
    assert.equal(data.paymentDate.getTime(), source.payments[0].paymentDate.getTime());
    assert.equal('attachments' in data, false);
});
test('da banco: singolo pagamento, creazione senza pagamenti e conversione inversa', async () => {
    for (const payments of [expense().payments, []]) {
        const h = setup({...expense(), payments});
        const preview = await h.send(counterInput);
        assert.equal(preview.status, 200);
        assert.equal(preview.body.warnings.length, 0);
        await h.send({...counterInput, confirmed: true, reviewToken: preview.body.reviewToken});
        assert.equal(payments.length ? h.updates[0].data.payments.update.data.amount : h.updates[0].data.payments.create.amount, 100);
    }
    const h = setup({...expense(), expenseType: 'COUNTER'});
    const preview = await h.send(payrollInput);
    assert.equal(preview.status, 200);
    await h.send({...payrollInput, confirmed: true, reviewToken: preview.body.reviewToken});
    assert.equal('payments' in h.updates[0].data, false);
});
test('da banco: metodo non valido, aliquota errata, snapshot scaduto e audit fallito bloccano il salvataggio', async () => {
    assert.equal((await setup(expense(), {methodDisabled: true}).send(counterInput)).status, 400);
    assert.equal((await setup().send({...counterInput, vatRate: 12})).status, 400);
    const h = setup();
    const preview = await h.send(counterInput);
    const snapshot = h.snapshot();
    h.source.payments[0].amount = '30';
    assert.equal((await h.send({...counterInput, snapshot, confirmed: true, reviewToken: preview.body.reviewToken})).status, 409);
    const failing = setup(expense(), {auditFails: true});
    const review = await failing.send(counterInput);
    assert.equal((await failing.send({...counterInput, confirmed: true, reviewToken: review.body.reviewToken})).status, 500);
    assert.equal(failing.updates.length, 0);
});

test('movimenti generati: conversione preserva origine, automazione, pagamenti e allegati', async () => {
    for (const targetType of ['PAYROLL', 'TAX_CONTRIBUTION', 'STANDARD']) {
        const source = {...expense(), expenseType: targetType === 'STANDARD' ? 'PAYROLL' : 'STANDARD',
            isRecurring: true, recurringExpenseId: 42, recurringExpensePeriodKey: '2026-09', isAutomaticPayment: true};
        const h = setup(source);
        const input = {...payrollInput, targetType, supplierId: 5, taxAuthorityId: 9};
        const preview = await h.send(input);
        assert.equal(preview.status, 200);
        assert.ok(preview.body.warnings.some((warning: string) => warning.includes('solo questo movimento')));
        assert.equal((await h.send({...input, confirmed: true, reviewToken: preview.body.reviewToken})).status, 200);
        const data = h.updates[0].data;
        assert.equal(data.expenseType, targetType);
        for (const field of ['isRecurring', 'recurringExpenseId', 'recurringExpensePeriodKey', 'isAutomaticPayment', 'payments', 'attachments']) {
            assert.equal(field in data, false, field);
        }
        assert.equal(h.audits[0].data.metadata.after.recurringExpenseId, 42);
        assert.equal(h.audits[0].data.metadata.after.recurringExpensePeriodKey, '2026-09');
    }
});

test('spesa generata da banco: conserva il pagamento completo, rifiuta assenti, parziali e multipli', async () => {
    const source: RecordData = {...expense(), isRecurring: true, recurringExpenseId: 42, recurringExpensePeriodKey: '2026-09'};
    source.payments[0].amount = '100';
    const h = setup(source);
    const preview = await h.send(counterInput);
    assert.equal(preview.status, 200);
    assert.equal((await h.send({...counterInput, confirmed: true, reviewToken: preview.body.reviewToken})).status, 200);
    const data = h.updates[0].data;
    assert.equal(data.expenseType, 'COUNTER');
    for (const field of ['payments', 'attachments', 'recurringExpenseId', 'recurringExpensePeriodKey', 'isRecurring']) assert.equal(field in data, false);
    for (const payments of [[], [{...source.payments[0], amount: '20'}], [source.payments[0], {...source.payments[0], id: 32}]]) {
        const invalid = setup({...source, payments});
        const result = await invalid.send(counterInput);
        assert.equal(result.status, 400);
        assert.match(result.body.error, /unico pagamento/);
        assert.equal(invalid.updates.length, 0);
    }
    assert.equal((await setup(source).send({...counterInput, amount: '120'})).status, 400);
});

test('incasso generato: scontrino e conversione inversa mantengono origine e accredito', async () => {
    for (const incomeType of ['STANDARD', 'CASH_REGISTER']) {
        const source = {...income(), incomeType, recurringIncomeId: 42, recurringIncomePeriodKey: '2026-09'};
        const input = incomeType === 'STANDARD' ? cashInput : {...cashInput, targetType: 'STANDARD', customerId: 5, orderDate: '2026-09-10', dueDate: '2026-09-10', billingPeriod: '2026-09'};
        const h = setup(source);
        const preview = await h.send(input, 'incomes');
        assert.equal(preview.status, 200);
        assert.ok(preview.body.warnings.some((warning: string) => warning.includes('prossime occorrenze')));
        assert.equal((await h.send({...input, confirmed: true, reviewToken: preview.body.reviewToken}, 'incomes')).status, 200);
        for (const field of ['credits', 'attachments', 'recurringIncomeId', 'recurringIncomePeriodKey']) assert.equal(field in h.updates[0].data, false);
        assert.equal(h.audits[0].data.metadata.after.recurringIncomeId, 42);
    }
    const h = setup({...income(), recurringIncomeId: 42, credits: [], isCredited: false});
    assert.equal((await h.send(cashInput, 'incomes')).status, 400);
    assert.equal(h.updates.length, 0);
});
