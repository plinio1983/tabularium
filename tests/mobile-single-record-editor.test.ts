import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as currency from '../lib/currency-input';
import * as companyTime from '../lib/company-time';

const require = createRequire(import.meta.url);
const compile = (file: string) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
function nodes(tree: any): any[] {if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)];}
function setup() {
  const state: any[] = []; let index = 0, closes = 0;
  const exports: any = {};
  runInNewContext(compile('../components/BulkEditFieldsModal.tsx'), {exports, document: {body: {}, querySelector: () => null}, require: (name: string) => {
    if (name === 'react') return {useState: (initial: any) => {const i = index++; if (!(i in state)) state[i] = initial; return [state[i], (value: any) => state[i] = typeof value === 'function' ? value(state[i]) : value];}, useRef: (initial: any) => ({current: initial}), useEffect() {}};
    if (name === 'react-dom') return {createPortal: (tree: any) => tree};
    if (name.endsWith('CompanyTimeZoneProvider')) return {useCompanyTimeZone: () => 'Europe/Rome'};
    if (name.endsWith('currency-input')) return currency;
    if (name.endsWith('company-time')) return companyTime;
    if (name.endsWith('FormControls')) return {FormField: 'FormField', DateField: 'DateField', MonthField: 'MonthField', SelectField: 'SelectField'};
    if (name.endsWith('CurrencyInput')) return {CurrencyInput: 'CurrencyInput'};
    if (name === 'react/jsx-runtime') return require(name);
    return {default: name};
  }});
  const record = {id: 7, amount: '100.50', description: 'Originale', notes: 'Nota', receivedDate: '2026-09-10', dueDate: '2026-09-20', categoryId: 3, supplierId: 4, month: 9, year: 2026, invoiceStatus: 'RICEVUTA', vatRate: '10'};
  return {get closes() {return closes;}, render() {index = 0; return exports.default({formId: 'single', subject: 'spese', action: '/api/expenses/bulk', singleRecord: record, onClose: () => closes++, categories: [{value: '3', label: 'Categoria'}], suppliers: [{id: 4, businessName: 'Fornitore'}], supplierEligibleIds: [7]});}};
}
test('single editor shares the bulk modal, prefills groups and posts only the selected group', () => {
  for (const [label, action, field, expected] of [['Importo', 'change_amount', 'amount', 100.5], ['Note', 'change_notes', 'notes', 'Nota'], ['Esercente, categoria e descrizione', 'change_identity', 'categoryId', 3]]) {
    const app = setup();
    const initial = nodes(app.render());
    assert.ok(initial.find(node => node.props?.className === 'bulk-category-modal bulk-edit-fields-modal'));
    const choice = initial.find(node => node.type === 'button' && nodes(node).some(child => child.type === 'strong' && child.props.children === label));
    choice.props.onClick();
    const all = nodes(app.render());
    assert.equal(all.find(node => node.props?.name === 'bulkAction').props.value, action);
    const control = all.find(node => node.props?.name === field);
    assert.equal(control.props.defaultValue ?? control.props.value, expected);
    assert.equal(all.some(node => node.props?.name?.startsWith('payment') || node.props?.name?.startsWith('credit')), false);
    if (action === 'change_amount') {
      assert.equal(all.some(node => node.props?.name === 'description'), false);
      assert.equal(all.filter(node => node.type === 'button' && ['1','2','3','4','5','6','7','8','9',',','0','Cancella ultima cifra'].includes(node.props['aria-label'])).length, 12);
    }
    if (action === 'change_identity') assert.equal(all.find(node => node.props?.name === 'description').props.defaultValue, 'Originale');
  }
});
test('dates and invoice values are prefilled; Back returns to the shared choice view; Escape closes', () => {
  const app = setup();
  let all = nodes(app.render());
  all.find(node => node.type === 'button' && nodes(node).some(child => child.props?.children === 'Data ordine e scadenza')).props.onClick();
  all = nodes(app.render());
  for (const name of ['updateOrderDate', 'updateDueDate']) {
    const flag = all.find(node => node.props?.name === name);
    assert.equal(flag.props.type, 'hidden');
    assert.equal(flag.props.value, 'true');
  }
  assert.equal(all.some(node => node.props?.type === 'checkbox'), false);
  assert.equal(all.find(node => node.props?.name === 'dueDate').props.value, '2026-09-20');
  assert.equal(nodes(app.render()).find(node => node.type === 'DateField').props.value, '2026-09-10');
  all.find(node => node.type === 'button' && node.props.className === 'btn btn-md btn-ghost').props.onClick();
  assert.ok(nodes(app.render()).some(node => node.props?.className === 'bulk-edit-fields-list'));
  nodes(app.render()).find(node => node.props?.role === 'presentation').props.onKeyDown({key: 'Escape', stopPropagation() {}});
  assert.equal(app.closes, 1);
});

test('dedicated edit pages retain the full desktop form and specialize only mobile standard documents', () => {
  const exports: any = {}, states: any[] = [], effects: any[] = []; let index = 0, mobile = false;
  runInNewContext(compile('../components/SingleRecordFieldsModal.tsx'), {exports, window: {matchMedia: () => ({matches: mobile, addEventListener() {}, removeEventListener() {}})}, require: (name: string) => {
    if (name === 'react') return {useState: (initial: any) => {const i = index++; if (!(i in states)) states[i] = initial; return [states[i], (value: any) => states[i] = value];}, useEffect: (effect: any) => effects.push(effect)};
    if (name === 'next/navigation') return {useRouter: () => ({replace() {}})};
    if (name === 'react/jsx-runtime') return require(name);
    return {default: 'BulkEditFieldsModal'};
  }});
  const desktop = {type: 'OriginalForm'};
  const render = (record: any = {id: 7, expenseType: 'STANDARD'}) => {index = 0; return exports.ResponsiveRecordEdit({kind: 'expenses', record, returnTo: '/expenses', children: desktop});};
  assert.equal(render(), desktop);
  effects.at(-1)();
  assert.equal(render(), desktop);
  mobile = true; effects.at(-1)();
  const single = render();
  assert.equal(single.type, exports.default);
  assert.equal(single.type(single.props).type, 'BulkEditFieldsModal');
  for (const expenseType of ['PAYROLL', 'COUNTER', 'VAT_SETTLEMENT', 'TAX_CONTRIBUTION']) assert.equal(render({id: 7, expenseType}), desktop);
  assert.equal(exports.supportsRecordFields({id: 7, incomeType: 'CASH_REGISTER'}), false);
  assert.equal(exports.supportsRecordFields({id: 7, incomeType: 'STANDARD'}), true);
});

test('single accounting groups show all controls without switches; multiple groups retain opt-in switches', () => {
  const app = setup();
  nodes(app.render()).find(node => node.type === 'button' && nodes(node).some(child => child.props?.children === 'Informazioni fiscali e contabili')).props.onClick();
  const fields = nodes(app.render()).filter(node => typeof node.type === 'function' && node.props?.name?.startsWith('update'));
  assert.equal(fields.length, 5);
  for (const field of fields) {
    const single = nodes(field.type(field.props));
    const flag = single.find(node => node.props?.name === field.props.name);
    assert.equal(flag.props.type, 'hidden');
    assert.equal(flag.props.value, 'true');
    assert.ok(single.some(node => node.props?.className === 'bulk-edit-accounting-control'));
    assert.equal(single.some(node => node.props?.type === 'checkbox'), false);
    const multiple = nodes(field.type({...field.props, single: false, active: false}));
    assert.equal(multiple.find(node => node.props?.name === field.props.name).props.type, 'checkbox');
    assert.equal(multiple.some(node => node.props?.className === 'bulk-edit-accounting-control'), false);
  }
});

test('income single editor groups customer, channel and description without separate choices', () => {
  // Exercise the shared component with income props rather than expense-only labels.
  const source = compile('../components/BulkEditFieldsModal.tsx');
  const exports: any = {}; let step = 'choice';
  runInNewContext(source, {exports, document: {body: {}}, require: (name: string) => {
    if (name === 'react') return {useState: (initial: any) => [initial === 'choice' ? step : initial, (value: any) => {if (['identity', 'choice'].includes(value)) step = value;}], useRef: () => ({current: {separatorDigits: null}}), useEffect() {}};
    if (name === 'react-dom') return {createPortal: (tree: any) => tree};
    if (name.endsWith('CompanyTimeZoneProvider')) return {useCompanyTimeZone: () => 'Europe/Rome'};
    if (name === 'react/jsx-runtime') return require(name);
    if (name.endsWith('FormControls')) return {FormField: 'FormField'};
    return {default: name};
  }});
  const render = () => nodes(exports.default({formId: 'income', subject: 'incassi', action: '/api/incomes/bulk', singleRecord: {id: 7, customerId: 4, salesChannelId: 3, description: 'Originale'}, editableIds: [7], customers: [{id: 4, businessName: 'Cliente'}], salesChannels: [{id: 3, name: 'Canale'}]}));
  let all = render();
  assert.equal(all.some(node => node.type === 'strong' && ['Cliente', 'Canale di vendita'].includes(node.props.children)), false);
  all.find(node => node.type === 'button' && nodes(node).some(child => child.props?.children === 'Cliente, canale di vendita e descrizione')).props.onClick();
  all = render();
  assert.equal(all.find(node => node.props?.name === 'bulkAction').props.value, 'change_identity');
  assert.equal(all.find(node => node.props?.name === 'salesChannelId').props.value, '3');
  assert.equal(all.find(node => node.props?.name === 'description').props.defaultValue, 'Originale');
});

test('amount keypad edits cents and keeps description out of the submitted group', () => {
  const app = setup();
  nodes(app.render()).find(node => node.type === 'button' && nodes(node).some(child => child.type === 'strong' && child.props.children === 'Importo')).props.onClick();
  let all = nodes(app.render());
  all.find(node => node.type === 'button' && node.props['aria-label'] === 'Cancella ultima cifra').props.onClick();
  all = nodes(app.render());
  assert.equal(all.find(node => node.props?.name === 'amount').props.value, 10.05);
  all.find(node => node.type === 'button' && node.props['aria-label'] === '2').props.onClick();
  assert.equal(nodes(app.render()).find(node => node.props?.name === 'amount').props.value, 100.52);
  assert.equal(nodes(app.render()).some(node => node.props?.name === 'description'), false);
});
