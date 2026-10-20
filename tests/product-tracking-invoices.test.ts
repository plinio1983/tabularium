import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as invoiceTools from '../lib/product-tracking-invoice';
import * as companyTime from '../lib/company-time';
import * as dateFormat from '../lib/date-format';
import * as documentTools from '../lib/product-tracking-document';
import * as ageTools from '../lib/tracking-document-age';

const require = createRequire(import.meta.url);
function nodes(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree?.props ? [tree, ...nodes(tree.props.children)] : [];
}
function harness(initialInvoices: any[] = [], detail = false, readOnly = false, extraProps: Record<string, unknown> = {}) {
  const state: any[] = [], refs: any[] = [], calls: any[] = [];
  let cursor = 0, refCursor = 0, refreshed = 0;
  const destinations: string[] = [];
  const source = ts.transpileModule(readFileSync('components/ProductTrackingAttachments.tsx', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const exports: any = {};
  const mocks: Record<string, any> = {
    react: {
      useState(initial: any) {const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], (next: any) => {state[i] = typeof next === 'function' ? next(state[i]) : next;}];},
      useRef(value: any) {const i = refCursor++; return refs[i] ?? (refs[i] = {current: value});},
      useId: () => 'invoice', useEffect() {},
    },
    'react-dom': {createPortal: (tree: any) => tree},
    'next/navigation': {useRouter: () => ({refresh() {refreshed++;}, push(href: string) {destinations.push(href);}})},
    '@/components/FormControls': {DateField: 'DateField', FormField: 'Field'},
    '@/components/InfoHint': {default: 'InfoHint'},
    '@/lib/product-tracking-invoice': invoiceTools,
    '@/lib/product-tracking-document': documentTools,
    '@/lib/company-time': {...companyTime, dateInputInTimeZone: () => '2026-10-20'},
    '@/components/CompanyTimeZoneProvider': {useCompanyTimeZone: () => 'Europe/Rome'},
    '@/lib/tracking-document-age': ageTools,
    '@/lib/date-format': dateFormat,
  };
  runInNewContext(source, {exports, require: (id: string) => mocks[id] ?? require(id), FormData, Error, document: {body: {}}, window: {confirm: () => true},
    fetch: async (url: string, options: any) => {calls.push({url, ...options}); return {ok: true, json: async () => ({id: 10, originalName: 'new.pdf', invoiceDate: '2026-01-02T00:00:00.000Z', documentDate: '2026-01-02T00:00:00.000Z', sizeBytes: 100})};}});
  const render = () => {cursor = 0; refCursor = 0; return nodes(exports.default({initialAttachments: initialInvoices, ...(detail ? {trackingId: 9} : {}), readOnly, ...extraProps}));};
  const button = (label: string) => render().find(node => node.type === 'button' && (Array.isArray(node.props.children) ? node.props.children : [node.props.children]).some((value: any) => typeof value === 'string' && value.trim() === label));
  const setDocument = () => render().find(node => node.type === 'input' && node.props.type === 'file').props.onChange({currentTarget: {files: [new File(['%PDF-test'], 'new.pdf', {type: 'application/pdf'})], value: 'selected'}});
  const setDate = (value: string) => render().find(node => node.type === 'DateField').props.onChange(value);
  return {render, button, setDocument, setDate, calls, destinations, refreshed: () => refreshed};
}

test('new invoice requires one document and a date, confirmation creates a summary without writing immediately', async () => {
  const ui = harness(); ui.button('Aggiungi fattura').props.onClick();
  assert.equal(ui.button('Aggiungi fattura').props.disabled, true);
  await ui.button('Conferma').props.onClick(); assert.ok(ui.render().some(node => node.props.role === 'alert'));
  ui.setDocument(); await ui.button('Conferma').props.onClick();
  assert.ok(ui.render().some(node => node.type === 'DateField'));
  ui.setDate('2026-01-02'); await ui.button('Conferma').props.onClick();
  assert.equal(ui.render().filter(node => node.type === 'DateField').length, 0);
  assert.ok(ui.button('Modifica')); assert.ok(ui.button('Elimina'));
  assert.equal(ui.calls.length, 0);
});

test('cancelling an edit preserves the confirmed invoice and deleting frees a slot', () => {
  const initial = Array.from({length: 5}, (_, i) => ({id: i + 1, originalName: `${i}.pdf`, invoiceDate: '2026-01-01'}));
  const ui = harness(initial); assert.equal(ui.button('Aggiungi fattura').props.disabled, true);
  ui.button('Modifica').props.onClick(); ui.setDate('2026-02-02'); ui.button('Annulla').props.onClick();
  ui.button('Modifica').props.onClick(); assert.equal(ui.render().find(node => node.type === 'DateField').props.value, '2026-01-01');
  ui.button('Annulla').props.onClick(); ui.button('Elimina').props.onClick();
  assert.equal(ui.button('Aggiungi fattura').props.disabled, false);
});

test('detail confirmations persist immediately and refresh the record', async () => {
  const ui = harness([], true); ui.button('Aggiungi fattura').props.onClick(); ui.setDocument(); ui.setDate('2026-01-02');
  await ui.button('Conferma').props.onClick();
  assert.equal(ui.calls[0].url, '/api/product-trackings/9/invoices');
  assert.equal(ui.calls[0].body.get('invoiceDate'), '2026-01-02');
  assert.equal(ui.refreshed(), 1);

});

test('viewers can open invoices but have no mutation controls', () => {
  const ui = harness([{id: 1, originalName: 'invoice.pdf', invoiceDate: '2026-01-01'}], true, true);
  assert.equal(ui.render().filter(node => node.type === 'button').length, 0);
  assert.ok(ui.render().some(node => node.type === 'a' && node.props.href === '/api/product-tracking-attachments/1?download=1'));
});

test('serialization keeps new invoice dates aligned and sends replacements under existing IDs', () => {
  const file = new File(['%PDF'], 'invoice.pdf'); const data = new FormData();
  invoiceTools.appendTrackingInvoices(data, {hasDraft: false, removedIds: [8], rows: [
    {key: 'new2', file, originalName: file.name, invoiceDate: '2026-02-02'},
    {key: 'saved1', id: 1, file, originalName: file.name, invoiceDate: '2026-01-01'},
  ]});
  assert.equal(data.get('invoiceDate-new-0'), '2026-02-02');
  assert.equal(data.getAll('INVOICE').length, 1);
  assert.equal(data.get('invoiceDate-1'), '2026-01-01');
  assert.equal(data.getAll('invoiceReplacement-1').length, 1);
  assert.equal(data.get('removedIds'), '8');
  assert.throws(() => invoiceTools.appendTrackingInvoices(new FormData(), {rows: [], removedIds: [], hasDraft: true}), /Conferma/);
});


test('detail management opens the matching step even with five attachments', () => {
  const trigger = createElement('TrackingEditor', {initialMobileStep: 3, triggerLabel: 'Gestisci fatture'});
  const ui = harness([], true, false, {addAttachmentTrigger: trigger});
  const editor = ui.render().find(node => node.type === 'TrackingEditor');
  assert.equal(editor.props.initialMobileStep, 3);
  assert.equal(editor.props.openNewInvoice, undefined);
  assert.equal(editor.props.triggerLabel, 'Gestisci fatture');
  assert.equal(ui.render().find(node => node.props.className === 'product-tracking-add-trigger').props.disabled, false);
  assert.deepEqual(ui.destinations, []);
  assert.equal(ui.calls.length, 0);
  const full = harness(Array.from({length: 5}, (_, i) => ({id: i + 1, originalName: `${i}.pdf`, invoiceDate: '2026-01-01'})), true, false, {addAttachmentTrigger: trigger});
  assert.equal(full.render().find(node => node.props.className === 'product-tracking-add-trigger').props.disabled, false);
});

test('an editor opened for adding an invoice starts a single draft and respects the five invoice limit', () => {
  const ui = harness([], false, false, {initiallyAddAttachment: true});
  assert.equal(ui.render().filter(node => node.type === 'DateField').length, 1);
  assert.equal(ui.button('Aggiungi fattura').props.disabled, true);
  const full = harness(Array.from({length: 5}, (_, i) => ({id: i + 1, originalName: `${i}.pdf`, invoiceDate: '2026-01-01'})), false, false, {initiallyAddAttachment: true});
  assert.equal(full.render().filter(node => node.type === 'DateField').length, 0);
  assert.equal(full.button('Aggiungi fattura').props.disabled, true);
});

test('tracking documents use the same confirmation flow with a required document date', async () => {
  const ui = harness([], false, false, {kind: 'TRACKING'});
  ui.button('Aggiungi documento').props.onClick();
  assert.equal(ui.render().find(node => node.type === 'DateField').props.label, 'Data documento *');
  await ui.button('Conferma').props.onClick();
  assert.ok(ui.render().some(node => node.props.role === 'alert'));
  ui.setDocument(); await ui.button('Conferma').props.onClick();
  assert.ok(ui.render().some(node => node.props.role === 'alert'));
  ui.setDate('2026-01-02'); await ui.button('Conferma').props.onClick();
  assert.ok(ui.button('Modifica')); assert.ok(ui.button('Elimina'));
  assert.equal(ui.render().some(node => node.type === 'span' && node.props.children === 'Data fattura'), false);
  assert.equal(ui.calls.length, 0);
});



test('tracking document serialization contains files, replacements and removals and document dates', () => {
  const file = new File(['%PDF'], 'tracking.pdf');
  const data = new FormData();
  documentTools.appendTrackingDocuments(data, {hasDraft: false, removedIds: [9], rows: [
    {key: 'new', file, originalName: file.name, invoiceDate: '', documentDate: '2026-01-02'},
    {key: 'saved', id: 4, file, originalName: file.name, invoiceDate: '', documentDate: '2026-01-02'},
  ]});
  assert.deepEqual([...data.keys()], ['TRACKING', 'documentDate-new-0', 'documentDate-4', 'trackingReplacement-4', 'removedIds']);
  assert.throws(() => documentTools.appendTrackingDocuments(new FormData(), {hasDraft: true, rows: [], removedIds: []}), /Conferma/);
});


test('empty tracking detail renders deferred server triggers without cloning them', () => {
  for (const kind of ['INVOICE', 'TRACKING']) {
    const trigger = createElement('button', {type: 'button'}, 'Aggiungi');
    // Flight may deliver a server-provided ReactNode as a lazy reference rather
    // than a ReactElement. cloneElement on this object creates an undefined type.
    const deferred = {$$typeof: Symbol.for('react.lazy'), _payload: trigger, _init: (payload: unknown) => payload};
    const ui = harness([], true, false, {kind, addAttachmentTrigger: deferred});
    const group = ui.render().find(node => node.props.className === 'product-tracking-add-trigger');
    assert.ok(group);
    assert.equal(group.props.children, deferred);
    assert.equal(group.props.disabled, false);
    assert.match(renderToStaticMarkup(group), /<button type="button">Aggiungi<\/button>/);
    const full = harness(Array.from({length: 5}, (_, i) => ({id: i + 1, originalName: 'doc.pdf', invoiceDate: '2026-01-01'})), true, false, {kind, addAttachmentTrigger: deferred});
    const disabledGroup = full.render().find(node => node.props.className === 'product-tracking-add-trigger');
    assert.doesNotMatch(renderToStaticMarkup(disabledGroup), /<fieldset[^>]*disabled=""/);
    const readOnly = harness([], true, true, {kind, addAttachmentTrigger: deferred});
    assert.equal(readOnly.render().some(node => node.props.className === 'product-tracking-add-trigger'), false);
  }
});


test('detail shows the latest age and individual ages', async () => {
  for (const kind of ['INVOICE', 'TRACKING']) {
    const ui = harness([
      {id: 1, originalName: 'new.pdf', invoiceDate: '2026-10-15', documentDate: '2026-10-15'},
      {id: 2, originalName: 'old.pdf', invoiceDate: '2026-09-20', documentDate: '2026-09-20'},
    ], true, false, {kind});
    const headerAge = () => ui.render().find(node => node.type === 'small' && node.props.title === 'Documento più recente: 15 Ott 2026');
    assert.deepEqual(Array.from(headerAge().props.children), ['· ', '5 giorni']);
    const ages = ui.render().filter(node => node.type === 'small' && node.props.className === 'muted tracking-document-age').map(node => node.props.children);
    assert.ok(ages.includes('5 giorni')); assert.ok(ages.includes('1 Mese'));
  }
});


test('each saved detail attachment downloads, with a separate archive per document kind', () => {
  for (const kind of ['INVOICE', 'TRACKING']) {
    const ui = harness([{id: 4, originalName: 'documento.pdf', invoiceDate: '2026-01-01', documentDate: '2026-01-01'}], true, false, {kind});
    const download = ui.render().find(node => node.props.className === 'product-tracking-attachment-download');
    assert.equal(download.type, 'a');
    assert.equal(download.props.href, '/api/product-tracking-attachments/4?download=1');
    assert.equal(download.props.download, 'documento.pdf');
    const archive = ui.render().find(node => node.type === 'a' && node.props.href === `/api/product-trackings/9/attachments/archive?kind=${kind}`);
    assert.ok(archive); assert.equal(archive.props.download, true);
    assert.equal(ui.button('Modifica'), undefined); assert.equal(ui.button('Elimina'), undefined);
    assert.equal(harness([], true, false, {kind}).render().some(node => node.type === 'a' && node.props.href?.includes('/archive')), false);
  }
});
