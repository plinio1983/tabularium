import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as rules from '../lib/counter-expense-edit';
import * as companyTime from '../lib/company-time';
import * as currency from '../lib/currency-input';

const require = createRequire(import.meta.url);
function compile(path: string) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
}
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const formCode = compile('../components/CounterExpenseForm.tsx');
function formSetup(edit = false, customOptions: Record<string, unknown> = {}) {
  const state: any[] = [], refs: any[] = [], requests: any[] = [];
  let si = 0, ri = 0, saved = 0;
  let keyListener: ((event: any) => void) | undefined;
  const exports: any = {};
  runInNewContext(formCode, {exports, crypto: {randomUUID: () => '00000000-0000-4000-8000-000000000000'}, Element: class {}, window: {matchMedia: () => ({matches: true}), addEventListener: (_name: string, callback: any) => {keyListener = callback;}, removeEventListener() {}}, fetch: async (url: string, options: any) => {
    requests.push({url, method: options.method, body: JSON.parse(options.body)}); return {ok: true, json: async () => ({saved: true})};
  }, require: (name: string) => {
    if (name === 'react') return {
      useEffect: (effect: () => void) => effect(),
      useState(initial: any) {const index = si++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial; return [state[index], (value: any) => state[index] = typeof value === 'function' ? value(state[index]) : value];},
      useRef(initial: any) {const index = ri++; return refs[index] ??= {current: initial};}
    };
    if (name === 'next/navigation') return {useRouter: () => ({})};
    if (name === './FormControls') return {FormField: 'FormField', DateField: 'DateField', SelectField: 'SelectField'};
    if (name === './CurrencyInput') return {CurrencyInput: 'CurrencyInput'};
    if (name === './CompanyTimeZoneProvider') return {useCompanyTimeZone: () => 'Europe/Rome'};
    if (name === '@/lib/company-time') return companyTime;
    if (name === '@/lib/currency-input') return currency;
    if (name === 'react/jsx-runtime') return require(name);
    return {__esModule: true, default: name};
  }});
  return {requests, press(key: string, extra = {}) {let prevented = false; keyListener?.({key, preventDefault() {prevented = true;}, ...extra}); return prevented;}, get saved() {return saved;}, render() {
    si = 0; ri = 0;
    return exports.default({categories: [{id: 2, code: 'DEFAULT', name: 'Categoria'}], banks: [{id: 3, name: 'Banca'}], paymentMethods: [{id: 4, name: 'Contanti', systemRole: 'CASH'}],
      ...customOptions, mobileStepOffset: edit ? 0 : 1, initialDate: '2026-10-01', onSaved: () => saved++, onBackToType() {},
      initialExpense: edit ? {id: 8, counterSnapshot: 'snapshot', amount: '12', isDeclared: true, vatRate: 10, description: 'Acquisto', payments: [{id: 9, amount: '12', paymentDate: '2026-10-01T10:00:00Z', paymentMethodId: 4}]} : undefined});
  }};
}

test('mobile counter creation validates first step, preserves values going back, and saves without another payment modal', async () => {
  const app = formSetup();
  let tree = app.render();
  const actions = () => nodes(tree).find(node => node.type === './MobileFormStickyActions');
  assert.equal(actions().props.currentStep, 2);
  assert.equal(actions().props.submitStep, 3);
  actions().props.onNext(); tree = app.render();
  assert.equal(actions().props.currentStep, 2);
  for (const value of ['1', '2', '0', '0']) {
    nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === value).props.onClick(); tree = app.render();
  }
  actions().props.onNext(); tree = app.render();
  assert.equal(actions().props.currentStep, 3);
  assert.equal(nodes(tree).find(node => node.type === 'SelectField' && node.props.label === 'Canale di addebito').props.disabled, true);
  actions().props.onBack(); tree = app.render();
  assert.equal(nodes(tree).find(node => node.props?.['aria-label'] === 'Importo spesa').props.value, '12,00');
  actions().props.onNext(); tree = app.render();
  await tree.props.onSubmit({preventDefault() {}});
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].method, 'POST');
  assert.equal(app.requests[0].body.amount, 12);
  assert.equal(app.requests[0].body.paymentMethodId, 4);
  assert.equal(app.requests[0].body.bankId, null);
  assert.equal(app.saved, 1);
});

test('counter edit has two steps and sends existing payment ID and concurrency snapshot', async () => {
  const app = formSetup(true);
  let tree = app.render();
  let actions = nodes(tree).find(node => node.type === './MobileFormStickyActions');
  assert.equal(actions.props.currentStep, 1); assert.equal(actions.props.submitStep, 2);
  actions.props.onNext(); tree = app.render();
  await tree.props.onSubmit({preventDefault() {}});
  assert.equal(app.requests[0].method, 'PATCH');
  assert.equal(app.requests[0].body.snapshot, 'snapshot');
  assert.equal(app.requests[0].body.payments[0].id, 9);
  assert.equal(app.requests[0].body.vatRate, 10);
});

const routeCode = compile('../app/api/counter-expenses/route.ts');
function routeSetup({stale = false, invalidBank = false, denied = false} = {}) {
  const updates: any[] = [], paymentUpdates: any[] = [], queries: any[] = [], audits: any[] = [];
  const source = {id: 8, updatedAt: new Date('2026-10-01'), payments: [{id: 9, amount: '5'}, {id: 10, amount: '7'}], notes: 'Da conservare', invoiceDocumentPath: '/attachment'};
  const tx = {
    expense: {findFirst: async (args: any) => {queries.push(args); return source;}, update: async (args: any) => updates.push(args)},
    expenseCategory: {findFirst: async () => ({id: 2})}, paymentMethod: {findFirst: async () => ({id: 4, systemRole: null})},
    bank: {findFirst: async () => invalidBank ? null : {id: 3}},
    expensePayment: {update: async (args: any) => paymentUpdates.push(args), create: async () => assert.fail('Existing payments must not be recreated')},
    auditLog: {create: async (args: any) => audits.push(args)}
  };
  const exports: any = {};
  runInNewContext(routeCode, {exports, console, require: (name: string) => {
    if (name === '@/lib/counter-expense-edit') return rules;
    if (name === 'next/server') return {NextResponse: {json: (body: any, options?: any) => ({body, status: options?.status ?? 200})}};
    if (name === '@/lib/prisma') return {prisma: {$transaction: async (fn: any) => fn(tx)}};
    if (name === '@/lib/auth') return {workspaceOperationalRoles: [], getWorkspaceApiAccess: async () => denied ? {ok: false, error: 'Vietato', status: 403} : {ok: true, current: {workspace: {id: 1}, company: {id: 2, timeZone: 'Europe/Rome'}, user: {id: 3}}}};
    if (name === '@/lib/company-time') return companyTime;
    if (name.startsWith('@/')) return {};
    return require(name);
  }});
  const body = {id: 8, snapshot: stale ? 'stale' : rules.counterExpenseSnapshot(source), amount: 12, categoryId: 2, isDeductible: false, vatRate: 0, description: '', paymentDate: '2026-10-01T10:00:00Z', payments: [9,10].map((id, index) => ({id, amount: index ? 7 : 5, paymentDate: '2026-10-01T10:00:00Z', paymentMethodId: 4, bankId: 3}))};
  return {updates, paymentUpdates, queries, audits, body, run: () => exports.PATCH({json: async () => body})};
}

test('editing counter expenses keeps payment IDs, notes and attachments and scopes access to company', async () => {
  const app = routeSetup();
  assert.equal((await app.run()).status, 200);
  assert.deepEqual(app.paymentUpdates.map(row => row.where.id), [9,10]);
  assert.equal('payments' in app.updates[0].data, false);
  assert.equal('notes' in app.updates[0].data, false);
  assert.equal('attachments' in app.updates[0].data, false);
  assert.equal('invoiceDocumentPath' in app.updates[0].data, false);
  assert.equal(app.queries[0].where.companyId, 2);
  assert.equal(app.queries[0].where.expenseType, 'COUNTER');
  assert.equal(app.audits.length, 1);
});

for (const [name, options, status] of [['stale data', {stale: true}, 409], ['wrong bank', {invalidBank: true}, 400], ['permissions', {denied: true}, 403]] as const) {
  test(`counter edit rejects ${name} before writing`, async () => {
    const app = routeSetup(options);
    assert.equal((await app.run()).status, status);
    assert.equal(app.updates.length, 0); assert.equal(app.paymentUpdates.length, 0);
  });
}

test('counter edit rejects unequal totals and payment IDs belonging to another record', async () => {
  const app = routeSetup(); app.body.payments[0].amount = 4;
  assert.equal((await app.run()).status, 400);
  app.body.payments[0].amount = 5; app.body.payments[0].id = 99;
  assert.equal((await app.run()).status, 400);
  assert.equal(app.updates.length, 0);
});

test('counter choice stays inside expense creation and uses three total mobile steps', () => {
  const state: any[] = []; let index = 0;
  const exports: any = {};
  runInNewContext(compile('../components/ExpenseCreationSwitcher.tsx'), {exports, require: (name: string) => {
    if (name === 'react') return {useId: () => 'recurring', useState: (initial: any) => {
      const slot = index++; if (!(slot in state)) state[slot] = initial;
      return [state[slot], (value: any) => state[slot] = value];
    }};
    if (name === 'react/jsx-runtime') return require(name);
    return {__esModule: true, default: name};
  }});
  const render = () => {index = 0; return exports.default({categories: [], banks: [], paymentMethods: [], suppliers: [], expenseAction: '/api/expenses', recurringAction: '/api/recurring-expenses'});};
  let tree = render();
  nodes(tree).find(node => node.type === '@/components/ExpenseTypeChoice').props.onSelectCounter();
  tree = render();
  assert.equal(nodes(tree).find(node => node.type === './ExpenseTypeStep').props.totalSteps, 3);
  let counter = nodes(tree).find(node => node.type === './CounterExpenseForm');
  assert.equal(counter.props.hideMobileActions, true);
  nodes(tree).find(node => node.type === '@/components/MobileFormStickyActions').props.onNext();
  tree = render(); counter = nodes(tree).find(node => node.type === './CounterExpenseForm');
  assert.equal(counter.props.hideMobileActions, false);
  counter.props.onBackToType(); tree = render();
  assert.equal(nodes(tree).find(node => node.type === './CounterExpenseForm').props.hideMobileActions, true);
  assert.equal(nodes(tree).find(node => node.type === '@/components/ExpenseTypeChoice').props.selected, 'counter');
});

test('counter form reuses clearable currency input, mobile keypad and VAT buttons', () => {
  const app = formSetup(); const all = nodes(app.render());
  const amount = all.find(node => node.type === 'CurrencyInput');
  assert.equal(amount.props.clearable, true);
  assert.equal(amount.props.readOnly, undefined);
  assert.equal(amount.props.suppressSoftKeyboard, true);
  assert.equal(all.find(node => node.props?.['aria-label'] === 'Tastiera numerica').props.className, 'app-amount-keypad full');
  const vat = all.find(node => node.props?.['aria-label'] === 'Aliquota IVA');
  assert.equal(nodes(vat).filter(node => node.type === 'select').length, 0);
  assert.equal(nodes(vat).filter(node => node.type === 'button').length, 4);
  assert.equal(all.some(node => node.type === 'input' && node.props.placeholder === 'Spesa da banco'), true);
});

test('counter account defaults follow method configuration and cash; saved selections are preserved', () => {
  const options = {
    banks: [{id: 3, name: 'Principale', isPrimary: true}, {id: 5, name: 'POS'}, {id: 6, name: 'Cassa', isFallback: true}],
    paymentMethods: [{id: 4, name: 'Carta', isExpenseDefault: true, cashRegisterDefaultBankId: 5}, {id: 7, name: 'Contanti', systemRole: 'CASH'}, {id: 8, name: 'Bonifico'}]
  };
  const app = formSetup(false, options);
  let tree = app.render();
  const account = () => nodes(tree).find(node => node.type === 'SelectField' && node.props.label === 'Canale di addebito');
  const method = () => nodes(tree).find(node => node.type === 'SelectField' && node.props.label === 'Modalità di pagamento');
  assert.equal(method().props.value, '4'); assert.equal(account().props.value, '5');
  account().props.onChange('3'); tree = app.render();
  assert.equal(account().props.value, '3');
  method().props.onChange('7'); tree = app.render();
  assert.equal(account().props.value, '6'); assert.equal(account().props.disabled, true);
  method().props.onChange('8'); tree = app.render();
  assert.equal(account().props.value, '3'); assert.equal(account().props.disabled, false);
});

test('counter mobile category is in final step; physical number keys enter amount without input focus', () => {
  const app = formSetup();
  let tree = app.render();
  tree.props.ref.current = {getClientRects: () => [{}]};
  const sections = nodes(tree).filter(node => node.type === 'details');
  const firstCategory = nodes(sections[0]).find(node => node.type === 'SelectField' && node.props.label === 'Categoria');
  const lastCategory = nodes(sections[2]).find(node => node.type === 'SelectField' && node.props.label === 'Categoria');
  assert.equal(firstCategory.props.className, 'hidden-md-down');
  assert.equal(lastCategory.props.className, 'full hidden-md-up');
  for (const digit of ['1', '2', '0', '0']) assert.equal(app.press(digit), true);
  tree = app.render();
  assert.equal(nodes(tree).find(node => node.type === 'CurrencyInput').props.value, '12,00');
  assert.equal(app.press('9', {ctrlKey: true}), false);
  assert.equal(app.press('9', {defaultPrevented: true}), false);
  nodes(tree).find(node => node.type === './MobileFormStickyActions').props.onNext();
  tree = app.render();
  assert.equal(app.press('3'), false);
});
