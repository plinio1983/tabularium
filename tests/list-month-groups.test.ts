import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isSingleMonthRange, listDateSort, listDateValue, listMonthKey, listMonthLabel} from '../lib/list-month-groups';

const require = createRequire(import.meta.url);
function load(path: string, extra = '', globals = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8') + extra, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  const exports: any = {};
  runInNewContext(compiled, {exports, require, ...globals});
  return exports;
}
const MonthGroupedRecords = load('../components/MonthGroupedRecords.tsx').default;
const stamp = (date: string) => new Date(`${date}T00:00:00Z`).getTime();

test('periodi di un mese, periodi contabili e date con fuso orario', () => {
  assert.equal(isSingleMonthRange('2026-09-01', '2026-09-30'), true);
  assert.equal(isSingleMonthRange('2026-09', '2026-09'), true);
  assert.equal(isSingleMonthRange('2025-09', '2026-09'), false);
  assert.equal(isSingleMonthRange('', '2026-09'), false);
  assert.equal(listMonthKey(2026 * 12 + 12, 'billing'), '2026-12');
  assert.equal(listMonthKey(2027 * 12 + 1, 'billing'), '2027-01');
  assert.equal(listMonthLabel('2026-09'), 'Settembre 2026');
  const record = {receivedDate: new Date('2026-08-31T23:30:00Z'), createdAt: new Date('2026-08-31T23:30:00Z'), month: 10, year: 2026};
  for (const [field, expected] of [['receivedDate', '2026-08'], ['createdAt', '2026-09'], ['billingPeriod', '2026-10']]) {
    const sort = listDateSort(`${field}_desc`, 'Europe/Rome')!;
    assert.equal(listMonthKey(listDateValue(record, sort), sort.kind, sort.timeZone), expected);
  }
});

const records = [
  {key: 'cash', value: stamp('2026-08-30'), content: createElement('div', null, 'Scontrini')},
  {key: 'a', value: stamp('2026-09-05'), content: createElement('div', null, 'Incasso settembre')},
  {key: 'b', value: stamp('2026-08-10'), content: createElement('div', null, 'Incasso agosto')},
  {key: 'c', value: null, content: createElement('div', null, 'Data assente')}
];
const render = (sort: string, enabled = true, rows = records) => renderToStaticMarkup(createElement(MonthGroupedRecords, {
  sort: listDateSort(sort), enabled, records: rows
}));

test('mobile: un titolo per mese anche mescolando cumulativi e record ordinari, date mancanti in coda', () => {
  const html = render('creditDate_desc');
  assert.match(html, /Settembre 2026<\/h2><div>Incasso settembre<\/div><h2[^>]*>Agosto 2026<\/h2><div>Scontrini<\/div><div>Incasso agosto<\/div><h2[^>]*>Senza data<\/h2>/);
  assert.equal((html.match(/<h2/g) ?? []).length, 3);
  const ascending = render('creditDate_asc');
  assert.ok(ascending.indexOf('Agosto 2026') < ascending.indexOf('Settembre 2026'));
  assert.ok(ascending.indexOf('Senza data') > ascending.indexOf('Settembre 2026'));
});

test('mobile: niente titoli con un solo mese, nessun risultato, vista mensile o ordine non temporale', () => {
  assert.doesNotMatch(render('creditDate_desc', true, [records[0], records[2]]), /<h2/);
  assert.doesNotMatch(render('creditDate_desc', true, []), /<h2/);
  assert.doesNotMatch(render('creditDate_desc', false), /<h2/);
  assert.doesNotMatch(render('amount_desc'), /<h2/);
});

// Minimal DOM surface used by the existing table controller; verifies actual row mutations.
class Element {
  dataset: Record<string, string> = {};
  children: Element[] = [];
  parent?: Element;
  attrs: Record<string, string> = {};
  className = ''; textContent = ''; colSpan = 0;
  cells = [{}, {}, {}];
  classList = {add() {}, remove() {}};
  getAttribute(name: string) {return this.attrs[name] ?? null;}
  setAttribute(name: string, value: string) {this.attrs[name] = value;}
  remove() {if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);}
  appendChild(child: Element) {child.remove(); child.parent = this; this.children.push(child);}
  insertBefore(child: Element, before: Element) {child.remove(); child.parent = this; this.children.splice(this.children.indexOf(before), 0, child);}
  querySelectorAll(selector: string) {return this.children.filter(child => selector === '[data-month-heading]' ? child.dataset.monthHeading : child.attrs['data-sort-row'] !== undefined);}
}

test('desktop: aggiorna i titoli cambiando data/direzione e li rimuove per importo o vista mensile', () => {
  const body = new Element();
  for (const date of ['2026-09-05', '2026-08-10', '']) {
    const row = new Element();
    row.attrs = {'data-sort-row': '', 'data-sort-order-date': date ? String(stamp(date)) : '', 'data-sort-amount': '100'};
    body.appendChild(row);
  }
  const header = new Element();
  const table = {dataset: {monthGrouping: 'true'}, tBodies: {item: () => body},
    querySelector: (selector: string) => {header.attrs['data-sort-type'] = selector.includes('order-date') ? 'date' : 'number'; return header;},
    querySelectorAll: () => [header]};
  const {sortTable} = load('../components/SortableTableController.tsx', '\nexports.sortTable = applySort;', {document: {createElement: () => new Element()}});
  const labels = () => body.children.filter(row => row.dataset.monthHeading).map(row => row.children[0].children[0].textContent);
  sortTable(table, 'order-date', 'desc');
  assert.deepEqual(labels(), ['Settembre 2026', 'Agosto 2026', 'Senza data']);
  assert.ok(body.children.filter(row => row.dataset.monthHeading).every(row => row.children[0].colSpan === 3));
  sortTable(table, 'order-date', 'asc');
  assert.deepEqual(labels(), ['Agosto 2026', 'Settembre 2026', 'Senza data']);
  assert.equal(body.children.length, 6);
  sortTable(table, 'amount', 'desc');
  assert.deepEqual(labels(), []);
  assert.equal(body.children.length, 3);
  table.dataset.monthGrouping = 'false';
  sortTable(table, 'order-date', 'desc');
  assert.deepEqual(labels(), []);
});

test('scontrini mobile: gruppi condivisi nel fuso della società, senza titoli per un solo mese', () => {
  const ReceiptList = load('../components/CashRegisterReceiptList.tsx', '', {require: (name: string) => {
    if (name === '@/components/CompanyTimeZoneProvider') return {useCompanyTimeZone: () => 'Europe/Rome'};
    if (name === '@/components/MonthGroupedRecords') return {default: MonthGroupedRecords};
    if (name === './MobileRecordViews') return {MobileRecordCloseButton: () => null};
    if (name.startsWith('@/components/')) return {default: () => null};
    return require(name);
  }}).default;
  const receipt = (id: number, creditDate: string) => ({id, creditDate, description: `Ricevuta ${id}`, amount: 10, recurringIncomeId: null,
    isFiscal: true, vatRate: 22, salesChannelId: 1, paymentMethodId: 1, salesChannel: 'Negozio', paymentMethod: 'Contanti'});
  const rows = [receipt(1, '2026-09-30T22:30:00Z'), receipt(2, '2026-09-01T10:00:00Z'), receipt(3, '2025-09-01T10:00:00Z')];
  const renderReceipts = (receipts = rows, monthGrouping = true) => renderToStaticMarkup(createElement(ReceiptList, {receipts, monthGrouping, returnTo: '/incomes/cash-register/receipts'}));
  const html = renderReceipts();
  assert.match(html, /data-month-grouping="true" data-month-time-zone="Europe\/Rome"/);
  const headings = Array.from(html.matchAll(/<h2 class="list-month-heading">([^<]+)<\/h2>/g), match => match[1]);
  assert.deepEqual(headings, ['Ottobre 2026', 'Settembre 2026', 'Settembre 2025']);
  assert.ok(html.indexOf('Ottobre 2026') < html.indexOf('Settembre 2026'));
  assert.equal((html.match(/name="ids"/g) ?? []).length, 6);
  assert.doesNotMatch(renderReceipts([rows[1]]), /list-month-heading/);
  assert.doesNotMatch(renderReceipts([], true), /list-month-heading/);
  assert.doesNotMatch(renderReceipts(rows, false), /list-month-heading/);
});

test('scontrini desktop: raggruppamento nel fuso della società e colonne complete', () => {
  const body = new Element();
  for (const date of ['2026-09-30T22:30:00Z', '2026-09-01T10:00:00Z']) {
    const row = new Element(); row.cells = Array.from({length: 9}, () => ({}));
    row.attrs = {'data-sort-row': '', 'data-sort-date': String(new Date(date).getTime()), 'data-sort-amount': '10'};
    body.appendChild(row);
  }
  const header = new Element();
  const table = {dataset: {monthGrouping: 'true', monthTimeZone: 'Europe/Rome'}, tBodies: {item: () => body},
    querySelector: (selector: string) => {header.attrs['data-sort-type'] = selector.includes('date') ? 'date' : 'number'; return header;},
    querySelectorAll: () => [header]};
  const {sortTable} = load('../components/SortableTableController.tsx', '\nexports.sortTable = applySort;', {document: {createElement: () => new Element()}});
  const labels = () => body.children.filter(row => row.dataset.monthHeading).map(row => row.children[0].children[0].textContent);
  sortTable(table, 'date', 'desc');
  assert.deepEqual(labels(), ['Ottobre 2026', 'Settembre 2026']);
  assert.ok(body.children.filter(row => row.dataset.monthHeading).every(row => row.children[0].colSpan === 9));
  sortTable(table, 'date', 'asc');
  assert.deepEqual(labels(), ['Settembre 2026', 'Ottobre 2026']);
  sortTable(table, 'amount', 'desc');
  assert.deepEqual(labels(), []);
});
