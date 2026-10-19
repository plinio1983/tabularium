import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as flash from '../lib/flash';
import * as tracking from '../lib/product-tracking';
import * as companyTime from '../lib/company-time';
import * as invoiceTools from '../lib/product-tracking-invoice';
import * as documentTools from '../lib/product-tracking-document';
import * as wizardTools from '../lib/product-tracking-wizard';

const require = createRequire(import.meta.url);
function load(name: string, mocks: Record<string, unknown>, globals = {}) {
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  runInNewContext(source, {exports, require: (id: string) => mocks[id] ?? require(id), ...globals});
  return exports.default;
}
function nodes(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree?.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
class TestInput {
  disabled = false;
  validityMessage = '';
  focused = false;
  constructor(public name: string, public value: string, private step = '1') {}
  setCustomValidity(value: string) {this.validityMessage = value;}
  checkValidity() {return !this.validityMessage;}
  reportValidity() {return this.checkValidity();}
  focus() {this.focused = true;}
  closest(selector: string) {return selector === 'details' ? {open: false, parentElement: null} : {dataset: {trackingStep: this.step}};}
}
function editorHarness(record?: any, initialMobileStep = 1, openNewInvoice = false, initiallyOpen = true, openNewDocument = false) {
  const state: any[] = [];
  const refs: any[] = [];
  const destinations: string[] = [];
  let cursor = 0, refCursor = 0;
  const Editor = load('ProductTrackingEditor', {
    react: {
      useState(initial: any) {
        const index = cursor++;
        if (!(index in state)) state[index] = index === 0 ? true : typeof initial === 'function' ? initial() : initial;
        return [state[index], (next: any) => {state[index] = typeof next === 'function' ? next(state[index]) : next;}];
      },
      useRef(initial: any) {const index = refCursor++; return refs[index] ?? (refs[index] = {current: initial});},
      useId: () => 'test-editor', useEffect() {}, useCallback: (fn: any) => fn, useMemo: (fn: any) => fn(),
    },
    'react-dom': {createPortal: (tree: any) => tree},
    'next/navigation': {useRouter: () => ({push(href: string) {destinations.push(href);}, refresh() {}})},
    '@/components/MobileFormStickyActions': {default: 'Actions'},
    '@/lib/product-tracking-wizard': wizardTools,
    '@/components/ProductTrackingInvoices': {default: 'Invoices'},
    '@/components/ProductTrackingDocuments': {default: 'Documents'},
    '@/lib/product-tracking-document': documentTools,
    '@/lib/product-tracking-invoice': invoiceTools,
    '@/components/FormControls': {FormField: 'Field', DateField: 'DateField'},
    '@/components/InfoHint': {default: 'InfoHint'},
    '@/components/CompanyTimeZoneProvider': {useCompanyTimeZone: () => 'Europe/Rome'},
    '@/lib/company-time': {...companyTime, dateInputInTimeZone: (timeZone: string) => {assert.equal(timeZone, 'Europe/Rome'); return '2026-10-13';}},
    '@/lib/flash': flash,
    '@/lib/page-transition': {preparePageReturn() {}},
  }, {document: {body: {}}, HTMLInputElement: TestInput, window: {matchMedia: () => ({matches: true}), requestAnimationFrame: (callback: Function) => callback()}});
  const render = () => {cursor = 0; refCursor = 0; return nodes(Editor({initiallyOpen, record, initialMobileStep, openNewInvoice, openNewDocument}));};
  return Object.assign(render, {destinations, setFields(fields: TestInput[]) {
    render();
    const section = {querySelectorAll: () => fields};
    refs[0].current = {querySelector: () => section, querySelectorAll: () => fields};
  }});
}

test('an unconfirmed invoice prevents the parent form from saving', () => {
  const render = editorHarness();
  render().find(node => node.type === 'Invoices').props.onStateChange({rows: [], removedIds: [], hasDraft: true});
  const actions = render().find(node => node.type === 'Actions');
  assert.equal(actions.props.submitDisabled, true);
  assert.equal(actions.props.isSubmitting, false);
  render().find(node => node.type === 'Invoices').props.onStateChange({rows: [], removedIds: [], hasDraft: false});
  assert.equal(render().find(node => node.type === 'Actions').props.submitDisabled, false);
});

test('advanced filters keep the quick search and list sorting', () => {
  const Filters = load('ProductTrackingFilters', {
    react: {useState: () => [true, () => {}], useId: () => 'filters'},
    'next/navigation': {useRouter: () => ({push() {}})},
    '@/components/FilterDrawer': {default: 'Drawer'},
    '@/components/MobileFormStickyActions': {default: 'Actions'},
    '@/lib/product-tracking-wizard': wizardTools,
    '@/components/ProductTrackingInvoices': {default: 'Invoices'},
    '@/components/ProductTrackingDocuments': {default: 'Documents'},
    '@/lib/product-tracking-document': documentTools,
    '@/lib/product-tracking-invoice': invoiceTools,
    '@/components/FilterIcon': {default: 'Icon'},
    '@/components/FormControls': {FormField: 'Field'},
    '@/lib/product-tracking': tracking,
  });
  const hidden = nodes(Filters({filters: {q: 'olio', mobileSort: 'entry_desc'}})).filter(node => node.type === 'input' && node.props.type === 'hidden');
  assert.deepEqual(hidden.map(node => [node.props.name, node.props.value]), [['q', 'olio'], ['mobileSort', 'entry_desc']]);
});

test('deleting a tracking returns to the filtered list with clean feedback', async () => {
  const destinations: string[] = [];
  const Delete = load('ProductTrackingDelete', {
    react: {useState: () => [false, () => {}]},
    'next/navigation': {useRouter: () => ({push: (href: string) => destinations.push(href), refresh() {}})},
    '@/lib/flash': flash,
    '@/lib/page-transition': {preparePageReturn() {}},
  }, {window: {confirm: () => true}, fetch: async () => ({ok: true})});
  const button = nodes(Delete({id: 7, returnTo: '/product-trackings?q=olio&mobileSort=entry_desc&saved=updated'})).find(node => node.type === 'button');
  await button.props.onClick();
  assert.deepEqual(destinations, ['/product-trackings?q=olio&mobileSort=entry_desc&saved=deleted']);
});

test('required invoice dates reveal a collapsed section on invalid submission', () => {
  const render = editorHarness();
  const parent = {open: false, parentElement: null};
  const child = {open: false, parentElement: {closest: () => parent}};
  const form = render().find(node => node.type === 'form');
  form.props.onInvalidCapture({target: {closest: () => child}});
  assert.equal(child.open, true); assert.equal(parent.open, true);
});


test('new tracking leaves entry date empty while edits preserve an empty entry date', () => {
  const create = editorHarness();
  assert.equal(create().find(node => node.type === 'DateField' && node.props.name === 'entryDate').props.value, '');
  assert.equal(create().find(node => node.type === 'input' && node.props.name === 'batchYear').props.defaultValue, 2026);
  const edit = editorHarness({id: 9, name: 'Olio', batch: '001', batchYear: 2025, alias: null, entryDate: '', attachments: []});
  assert.equal(edit().find(node => node.type === 'input' && node.props.name === 'batchYear').props.defaultValue, 2025);
  assert.equal(edit().find(node => node.type === 'DateField' && node.props.name === 'entryDate').props.value, '');
});


test('mobile submit advances through three steps without sending a premature request', async () => {
  const render = editorHarness();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 1);
  let prevented = 0;
  await render().find(node => node.type === 'form').props.onSubmit({preventDefault() {prevented++;}, currentTarget: {}});
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 2);
  render().find(node => node.type === 'Actions').props.onNext();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 3);
  assert.equal(render().find(node => node.type === 'Actions').props.submitStep, 3);
  render().find(node => node.type === 'Actions').props.onBack();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 2);
  assert.equal(prevented, 1);
});

test('wizard navigation keeps selected tracking files and confirmed invoices', () => {
  const render = editorHarness();
  render().find(node => node.type === 'Actions').props.onNext();
  render().find(node => node.type === 'Documents').props.onStateChange({rows: [{key: 'document', originalName: 'tracking.pdf', invoiceDate: '', file: {name: 'tracking.pdf', size: 100}}], removedIds: [], hasDraft: false});
  render().find(node => node.type === 'Actions').props.onNext();
  render().find(node => node.type === 'Invoices').props.onStateChange({rows: [{key: 'invoice', originalName: 'invoice.pdf', invoiceDate: '2026-01-01'}], removedIds: [], hasDraft: false});
  render().find(node => node.type === 'Actions').props.onBack();
  assert.equal(render().find(node => node.type === 'Actions').props.nextDisabled, false);
  render().find(node => node.type === 'Actions').props.onNext();
  assert.equal(render().find(node => node.type === 'Actions').props.submitDisabled, false);
});

test('adding an invoice from a detail entry opens the editor at step three', () => {
  const render = editorHarness({id: 9, name: 'Olio', batch: '001', batchYear: 2025, alias: null, entryDate: '2026-01-01', attachments: []}, 3, true);
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 3);
  assert.equal(render().find(node => node.type === 'Actions').props.submitDisabled, true);
  assert.equal(render().find(node => node.type === 'Invoices').props.initiallyAddInvoice, true);
});


test('step one rejects whitespace-only required fields before advancing', () => {
  const render = editorHarness();
  const field = new TestInput('name', '   ');
  render.setFields([field]);
  render().find(node => node.type === 'Actions').props.onNext();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 1);
  assert.equal(field.focused, true);
  field.value = 'Olio';
  render().find(node => node.type === 'Actions').props.onNext();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 2);
});

test('final validation returns to the hidden step containing an invalid field', async () => {
  const render = editorHarness(undefined, 3);
  const field = new TestInput('batch', '');
  render.setFields([field]);
  await render().find(node => node.type === 'form').props.onSubmit({preventDefault() {}, currentTarget: {}});
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 1);
  assert.equal(field.focused, true);
});


test('the add-invoice editor trigger opens a modal at step three without changing the page', () => {
  const render = editorHarness({id: 9, name: 'Olio', batch: '001', batchYear: 2025, alias: null, entryDate: '2026-01-01', attachments: []}, 3, true, false);
  assert.equal(render().some(node => node.type === 'form'), false);
  const trigger = render().find(node => node.type === 'button');
  trigger.props.onClick();
  assert.ok(render().some(node => node.props.role === 'dialog'));
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 3);
  assert.equal(render().find(node => node.type === 'Invoices').props.initiallyAddInvoice, true);
  assert.deepEqual(render.destinations, []);
});

test('adding a tracking document opens the modal at step two without navigation', () => {
  const render = editorHarness({id: 9, name: 'Olio', batch: '001', batchYear: 2025, alias: null, entryDate: '2026-01-01', attachments: []}, 2, false, false, true);
  render().find(node => node.type === 'button').props.onClick();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 2);
  assert.equal(render().find(node => node.type === 'Documents').props.initiallyAddDocument, true);
  assert.equal(render().find(node => node.type === 'Actions').props.nextDisabled, true);
  assert.deepEqual(render.destinations, []);
});

test('an open tracking document draft blocks advancing until confirmed or cancelled', () => {
  const render = editorHarness();
  render().find(node => node.type === 'Actions').props.onNext();
  render().find(node => node.type === 'Documents').props.onStateChange({rows: [], removedIds: [], hasDraft: true});
  render().find(node => node.type === 'Actions').props.onNext();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 2);
  render().find(node => node.type === 'Documents').props.onStateChange({rows: [], removedIds: [], hasDraft: false});
  render().find(node => node.type === 'Actions').props.onNext();
  assert.equal(render().find(node => node.type === 'Actions').props.currentStep, 3);
});
