import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp, readdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as tracking from '../lib/product-tracking';
import * as attachmentTools from '../lib/attachments';
import * as invoiceFileTools from '../lib/product-tracking-invoice-file';
import {createZip} from '../lib/zip';

const require = createRequire(import.meta.url);
const current = {workspace: {id: 2}, company: {id: 3}, user: {id: 4}};
function load(file: string, db: any, options: {denied?: boolean; apiDenied?: boolean; attachments?: any; audit?: any; invoiceFile?: any} = {}) {
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText;
  const mocks: Record<string, any> = {
    '@/lib/prisma': {prisma: db},
    '@/lib/auth': {
      workspaceOperationalRoles: ['OWNER', 'ADMIN', 'ACCOUNTANT'],
      getWorkspaceApiAccess: async (roles: string[]) => {
        assert.deepEqual(Array.from(roles), ['OWNER', 'ADMIN', 'ACCOUNTANT']);
        return options.denied || options.apiDenied ? {ok: false, status: 403, error: 'Permessi insufficienti'} : {ok: true, current};
      },
      getWorkspaceContext: async () => options.denied ? null : current,
    },
    '@/lib/product-tracking': tracking,
    '@/lib/attachments': options.attachments ?? attachmentTools,
    '@/lib/zip': {createZip},
    '@/lib/product-tracking-invoice-file': options.invoiceFile ?? invoiceFileTools,
    '@/lib/audit': {writeAuditLog: options.audit ?? (async () => {})},
  };
  runInNewContext(source, {exports, require: (name: string) => mocks[name] ?? require(name), File, FormData, Error, Uint8Array, URL,
    console: {error() {}}});
  return exports;
}
function request(files: {kind: string; name: string; content?: string; date?: string}[] = []) {
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001-A'); form.set('batchYear', '2026');
  const indexes: Record<string, number> = {INVOICE: 0, TRACKING: 0};
  for (const item of files) {
    form.append(item.kind, new File([item.content ?? '%PDF-1.7\nfixture'], item.name, {type: 'application/pdf'}));
    if (item.date) form.set(`${item.kind === 'INVOICE' ? 'invoiceDate' : 'documentDate'}-new-${indexes[item.kind]}`, item.date);
    indexes[item.kind]++;
  }
  return new Request('http://localhost/api/product-trackings', {method: 'POST', body: form});
}
function database(existing: any = null, createError?: Error) {
  const queries: any[] = [], writes: any[] = [];
  const tx = {
    $queryRaw: async () => [],
    productTracking: {
      findFirst: async (args: any) => {queries.push(args); return existing;},
      create: async ({data}: any) => {if (createError) throw createError; writes.push(data); return {id: 9};},
      update: async ({data}: any) => {writes.push(data); return {id: 9};},
      delete: async () => {writes.push('deleted');},
    },
    productTrackingAttachment: {update: async () => {}, deleteMany: async () => {}},
  };
  return {queries, writes, $transaction: async (fn: any) => fn(tx)};
}

test('viewer cannot create or delete and no database access happens', async () => {
  const service = load('lib/product-tracking-save.ts', {$transaction() {assert.fail('Must not query');}}, {denied: true});
  assert.equal((await service.saveTracking(request())).status, 403);
  assert.equal((await service.deleteTracking(request(), 9)).status, 403);
});

test('editing and deleting foreign records uses workspace and company scope', async () => {
  const db = database(); const service = load('lib/product-tracking-save.ts', db);
  assert.equal((await service.saveTracking(request(), 99)).status, 404);
  assert.equal((await service.deleteTracking(request(), 99)).status, 404);
  for (const query of db.queries) assert.deepEqual(JSON.parse(JSON.stringify(query.where)), {id: 99, workspaceId: 2, companyId: 3});
  assert.equal(db.writes.length, 0);
});

test('invoice dates and empty files are rejected before saving a record', async () => {
  for (const files of [
    [{kind: 'INVOICE', name: 'invoice.pdf'}],
    [{kind: 'INVOICE', name: 'invoice.pdf', date: '2026-02-30'}],
    [{kind: 'INVOICE', name: 'empty.pdf', content: '', date: '2026-01-01'}, {kind: 'INVOICE', name: 'valid.pdf', date: '2026-02-02'}],
  ]) {
    const db = database(); const service = load('lib/product-tracking-save.ts', db);
    assert.equal((await service.saveTracking(request(files))).status, 400);
    assert.equal(db.writes.length, 0);
  }
});

test('the limit counts retained files and rejects six in either category', async () => {
  for (const kind of ['INVOICE', 'TRACKING']) {
    const db = database({id: 9, attachments: Array.from({length: 5}, (_, i) => ({id: i + 1, kind, path: `${i}.pdf`}))});
    const service = load('lib/product-tracking-save.ts', db);
    const response = await service.saveTracking(request([{kind, name: 'sixth.pdf', date: '2026-01-01'}]), 9);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /massimo 5/);
    assert.equal(db.writes.length, 0);
  }
});

test('five invoices plus five tracking documents save with independent dates and company scope', async () => {
  const db = database(); let saved = 0;
  const service = load('lib/product-tracking-save.ts', db, {attachments: {...attachmentTools, saveExpenseAttachmentFiles: async ([file]: File[]) => [{originalName: file.name, path: `${saved++}.pdf`, type: 'DOCUMENT', mimeType: file.type, sizeBytes: file.size}]}});
  const files = Array.from({length: 5}, (_, i) => ({kind: 'INVOICE', name: `invoice-${i}.pdf`, date: `2026-01-0${i + 1}`})).concat(Array.from({length: 5}, (_, i) => ({kind: 'TRACKING', name: `tracking-${i}.pdf`, date: `2026-02-0${i + 1}`})));
  assert.equal((await service.saveTracking(request(files))).status, 200);
  assert.equal(saved, 10); assert.equal(db.writes[0].workspaceId, 2); assert.equal(db.writes[0].companyId, 3);
  const invoices = db.writes[0].attachments.create.filter((a: any) => a.kind === 'INVOICE');
  assert.deepEqual(Array.from(invoices, (a: any) => a.invoiceDate.toISOString().slice(0, 10)), files.slice(0, 5).map(a => a.date));
});

test('failed database writes clean uploaded files and return no internal database details', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tracking-rollback-')); process.env.UPLOADS_DIR = directory;
  try {
    const db = database(null, new Error('internal connection details must stay private'));
    const service = load('lib/product-tracking-save.ts', db);
    const response = await service.saveTracking(request([{kind: 'INVOICE', name: 'invoice.pdf', date: '2026-01-01'}]));
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /internal connection/);
    assert.deepEqual(await readdir(path.join(directory, 'invoices')), []);
  } finally {delete process.env.UPLOADS_DIR; await rm(directory, {recursive: true, force: true});}
});

test('foreign attachments cannot be downloaded or read from storage', async () => {
  const service = load('app/api/product-tracking-attachments/[id]/route.ts', {productTrackingAttachment: {findFirst: async ({where}: any) => {
    assert.equal(where.tracking.workspaceId, 2); assert.equal(where.tracking.companyId, 3); return null;
  }}}, {attachments: {readExpenseAttachment() {assert.fail('Must not read a foreign file');}}});
  assert.equal((await service.GET(new Request('http://localhost'), {params: Promise.resolve({id: '9'})})).status, 404);
});

test('retained invoices require a date while removed invoices do not', async () => {
  const existing = {id: 9, attachments: [{id: 12, kind: 'INVOICE', path: 'test-fixture.pdf'}]};
  const first = database(existing);
  assert.equal((await load('lib/product-tracking-save.ts', first).saveTracking(request(), 9)).status, 400);
  assert.equal(first.writes.length, 0);
  const deletedPaths: string[] = [];
  const second = database(existing);
  const service = load('lib/product-tracking-save.ts', second, {attachments: {...attachmentTools, deleteExpenseAttachmentFile: async (storedPath: string) => {deletedPaths.push(storedPath);}}});
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.set('batchYear', '2026'); form.append('removedIds', '12');
  assert.equal((await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}), 9)).status, 200);
  assert.deepEqual(deletedPaths, ['test-fixture.pdf']);
});

test('an attachment from another tracking cannot be removed through an edited record', async () => {
  const db = database({id: 9, attachments: []});
  const service = load('lib/product-tracking-save.ts', db);
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.set('batchYear', '2026'); form.append('removedIds', '999');
  const response = await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}), 9);
  assert.equal(response.status, 400); assert.equal(db.writes.length, 0);
});


function invoiceDatabase(attachments: any[] = [], failCreate = false, kind = 'INVOICE') {
  const updates: any[] = [];
  const tx = {
    $queryRaw: async (_sql: any, id: number, workspaceId: number, companyId: number) => {
      assert.equal(id, 9); assert.equal(workspaceId, 2); assert.equal(companyId, 3);
      return [{id: 9}];
    },
    productTracking: {
      findFirst: async ({where, include}: any) => {
        assert.equal(where.workspaceId, 2); assert.equal(where.companyId, 3);
        assert.equal(include.attachments.where.kind, kind);
        return {id: 9, attachments: attachments.filter(a => a.kind === kind)};
      },
      update: async (data: any) => {updates.push(data); return {id: 9};},
    },
    productTrackingAttachment: {
      create: async ({data}: any) => {if (failCreate) throw new Error('db failed'); return {id: 20, ...data};},
      update: async ({where, data}: any) => {updates.push(data); return {...attachments.find(a => a.id === where.id), ...data};},
      delete: async ({where}: any) => attachments.find(a => a.id === where.id),
    },
  };
  return {updates, $transaction: async (fn: any) => fn(tx)};
}
function invoiceRequest(date = '2026-01-01', document = false) {
  const form = new FormData(); form.set('invoiceDate', date);
  if (document) form.append('document', new File(['%PDF-1.7\nfixture'], 'new.pdf', {type: 'application/pdf'}));
  return new Request('http://localhost', {method: 'POST', body: form});
}

test('single invoice endpoints reject viewers, missing dates and a sixth invoice', async () => {
  const denied = load('lib/product-tracking-attachment-service.ts', {}, {denied: true});
  assert.equal((await denied.mutateTrackingInvoice(invoiceRequest(), 9)).status, 403);
  const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase(Array.from({length: 5}, (_, i) => ({id: i + 1, kind: 'INVOICE'}))));
  assert.equal((await service.mutateTrackingInvoice(invoiceRequest('', true), 9)).status, 400);
  const response = await service.mutateTrackingInvoice(invoiceRequest('2026-01-01', true), 9);
  assert.equal(response.status, 400); assert.match((await response.json()).error, /massimo 5/);
});

test('single invoice edits retain the document when only its date changes', async () => {
  const existing = {id: 12, kind: 'INVOICE', path: 'old.pdf', originalName: 'old.pdf', invoiceDate: new Date('2026-01-01')};
  const db = invoiceDatabase([existing]); const service = load('lib/product-tracking-attachment-service.ts', db);
  const response = await service.mutateTrackingInvoice(invoiceRequest('2026-02-02'), 9, 12);
  assert.equal(response.status, 200);
  const record = await response.json(); assert.equal(record.id, 12); assert.equal(record.path, 'old.pdf');
  assert.equal(record.invoiceDate, '2026-02-02T00:00:00.000Z');
  assert.ok(db.updates.some(data => data.data?.updatedAt));
});

test('single invoice endpoints reject IDs belonging to tracking documents', async () => {
  const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([{id: 12, kind: 'TRACKING', path: 'tracking.pdf'}]));
  assert.equal((await service.mutateTrackingInvoice(invoiceRequest(), 9, 12)).status, 404);
  assert.equal((await service.mutateTrackingInvoice(invoiceRequest(), 9, 12, true)).status, 404);
});

test('invoice replacement removes the old file after success and keeps the record ID', async () => {
  const obsolete: string[] = [];
  const db = invoiceDatabase([{id: 12, kind: 'INVOICE', path: 'old.pdf'}]);
  const service = load('lib/product-tracking-attachment-service.ts', db, {
    invoiceFile: {saveTrackingInvoiceFile: async () => ({path: 'new.pdf', originalName: 'new.pdf', sizeBytes: 100})},
    attachments: {...attachmentTools, deleteExpenseAttachmentFile: async (storedPath: string) => {obsolete.push(storedPath);}},
  });
  const response = await service.mutateTrackingInvoice(invoiceRequest('2026-01-01', true), 9, 12);
  assert.equal(response.status, 200); const record = await response.json();
  assert.equal(record.id, 12); assert.equal(record.path, 'new.pdf'); assert.deepEqual(obsolete, ['old.pdf']);
});

test('failed single invoice inserts remove uploaded files', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'single-invoice-rollback-')); process.env.UPLOADS_DIR = directory;
  try {
    const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([], true));
    const response = await service.mutateTrackingInvoice(invoiceRequest('2026-01-01', true), 9);
    assert.equal(response.status, 500); assert.deepEqual(await readdir(path.join(directory, 'invoices')), []);
  } finally {delete process.env.UPLOADS_DIR; await rm(directory, {recursive: true, force: true});}
});

test('full tracking edits can replace a saved invoice while preserving its ID', async () => {
  const deleted: string[] = [], replacements: any[] = [];
  const existing = {id: 9, attachments: [{id: 12, kind: 'INVOICE', path: 'old.pdf'}]};
  const db = database(existing);
  const transaction = db.$transaction;
  db.$transaction = async (fn: any) => transaction(async (tx: any) => {
    tx.productTrackingAttachment.update = async (args: any) => {replacements.push(args);};
    return fn(tx);
  });
  const service = load('lib/product-tracking-save.ts', db, {
    invoiceFile: {saveTrackingInvoiceFile: async () => ({path: 'new.pdf', originalName: 'new.pdf'})},
    attachments: {...attachmentTools, deleteExpenseAttachmentFile: async (storedPath: string) => {deleted.push(storedPath);}},
  });
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.set('batchYear', '2026'); form.set('invoiceDate-12', '2026-01-01');
  form.append('invoiceReplacement-12', new File(['%PDF'], 'new.pdf'));
  assert.equal((await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}), 9)).status, 200);
  assert.equal(replacements[0].where.id, 12); assert.equal(replacements[0].data.path, 'new.pdf'); assert.deepEqual(deleted, ['old.pdf']);
});

test('a failed invoice replacement keeps the previous file and removes the new upload', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'invoice-replacement-rollback-')); process.env.UPLOADS_DIR = directory;
  try {
    const [original] = await attachmentTools.saveExpenseAttachmentFiles([new File(['%PDF-1.7\noriginal'], 'original.pdf', {type: 'application/pdf'})]);
    const db = invoiceDatabase([{...original, id: 12, kind: 'INVOICE'}]);
    const service = load('lib/product-tracking-attachment-service.ts', db, {audit: async () => {throw new Error('Commit rejected');}});
    const response = await service.mutateTrackingInvoice(invoiceRequest('2026-01-01', true), 9, 12);
    assert.equal(response.status, 500);
    assert.deepEqual(await readdir(path.join(directory, 'invoices')), [path.basename(original.path)]);
  } finally {delete process.env.UPLOADS_DIR; await rm(directory, {recursive: true, force: true});}
});

function documentRequest(date = '2026-02-02') {
  const form = new FormData(); form.append('document', new File(['%PDF-1.7\ntracking'], 'tracking.pdf', {type: 'application/pdf'}));
  form.set('documentDate', date);
  return new Request('http://localhost', {method: 'POST', body: form});
}
test('tracking document creation does not require or store an invoice date', async () => {
  const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([], false, 'TRACKING'), {
    invoiceFile: {saveTrackingInvoiceFile: async () => ({path: 'tracking.pdf', originalName: 'tracking.pdf', sizeBytes: 100})},
  });
  const response = await service.mutateTrackingDocument(documentRequest(), 9);
  assert.equal(response.status, 200);
  const record = await response.json(); assert.equal(record.kind, 'TRACKING'); assert.equal(record.invoiceDate, null); assert.equal(record.documentDate, '2026-02-02T00:00:00.000Z');
});
test('tracking documents have their own limit and cannot edit or delete invoice IDs', async () => {
  const full = load('lib/product-tracking-attachment-service.ts', invoiceDatabase(Array.from({length: 5}, (_, i) => ({id: i + 1, kind: 'TRACKING'})), false, 'TRACKING'));
  assert.equal((await full.mutateTrackingDocument(documentRequest(), 9)).status, 400);
  const mixed = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([{id: 12, kind: 'INVOICE'}], false, 'TRACKING'));
  assert.equal((await mixed.mutateTrackingDocument(documentRequest(), 9, 12)).status, 404);
  assert.equal((await mixed.mutateTrackingDocument(documentRequest(), 9, 12, true)).status, 404);
});
test('tracking document replacements preserve their ID and delete the old file after success', async () => {
  const removed: string[] = [];
  const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([{id: 4, kind: 'TRACKING', path: 'old-tracking.pdf'}], false, 'TRACKING'), {
    invoiceFile: {saveTrackingInvoiceFile: async () => ({path: 'new-tracking.pdf', originalName: 'new-tracking.pdf'})},
    attachments: {...attachmentTools, deleteExpenseAttachmentFile: async (storedPath: string) => {removed.push(storedPath);}},
  });
  const response = await service.mutateTrackingDocument(documentRequest(), 9, 4);
  assert.equal(response.status, 200); const record = await response.json();
  assert.equal(record.id, 4); assert.equal(record.path, 'new-tracking.pdf'); assert.equal(record.invoiceDate, null); assert.equal(record.documentDate, '2026-02-02T00:00:00.000Z');
  assert.deepEqual(removed, ['old-tracking.pdf']);
});

test('the full editor replaces tracking files under their original IDs with required document dates', async () => {
  const removed: string[] = [], updates: any[] = [];
  const db = database({id: 9, attachments: [{id: 4, kind: 'TRACKING', path: 'old-tracking.pdf'}]});
  const transaction = db.$transaction;
  db.$transaction = async (fn: any) => transaction(async (tx: any) => {
    tx.productTrackingAttachment.update = async (args: any) => {updates.push(args);};
    return fn(tx);
  });
  const service = load('lib/product-tracking-save.ts', db, {
    invoiceFile: {saveTrackingInvoiceFile: async (entries: any[]) => entries.length ? {path: 'new-tracking.pdf', originalName: 'new-tracking.pdf'} : null},
    attachments: {...attachmentTools, deleteExpenseAttachmentFile: async (storedPath: string) => {removed.push(storedPath);}},
  });
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.set('batchYear', '2026');
  form.set('documentDate-4', '2026-02-02');
  form.append('trackingReplacement-4', new File(['%PDF'], 'new-tracking.pdf'));
  assert.equal((await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}), 9)).status, 200);
  assert.equal(updates[0].where.id, 4); assert.equal(updates[0].data.path, 'new-tracking.pdf');
  assert.equal(updates[0].data.documentDate.toISOString().slice(0, 10), '2026-02-02'); assert.deepEqual(removed, ['old-tracking.pdf']);
});

 test('tracking document endpoints reject missing and invalid document dates', async () => {
  const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([], false, 'TRACKING'));
  for (const date of ['', '2026-02-30', 'invalid']) {
    const response = await service.mutateTrackingDocument(documentRequest(date), 9);
    assert.equal(response.status, 400);
  }
});
test('full editor requires a document date for retained legacy tracking attachments', async () => {
  const service = load('lib/product-tracking-save.ts', database({id: 9, attachments: [{id: 4, kind: 'TRACKING', path: 'old.pdf'}]}));
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.set('batchYear', '2026');
  const response = await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}), 9);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /data documento/);
});

test('document date can be updated without replacing the existing file', async () => {
  const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([{id: 4, kind: 'TRACKING', path: 'old.pdf'}], false, 'TRACKING'), {
    invoiceFile: {saveTrackingInvoiceFile: async () => null},
  });
  const form = new FormData(); form.set('documentDate', '2026-03-12');
  const response = await service.mutateTrackingDocument(new Request('http://localhost', {method: 'POST', body: form}), 9, 4);
  assert.equal(response.status, 200);
  const record = await response.json();
  assert.equal(record.path, 'old.pdf');
  assert.equal(record.documentDate, '2026-03-12T00:00:00.000Z');
});

test('batch year is required, validated and saved independently from entry date', async () => {
  for (const year of ['', '999', '10000', '2026.5', 'invalid']) {
    const db = database(); const service = load('lib/product-tracking-save.ts', db);
    const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.set('batchYear', year);
    const response = await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}));
    assert.equal(response.status, 400); assert.equal(db.writes.length, 0);
  }
  const db = database(); const service = load('lib/product-tracking-save.ts', db);
  const response = await service.saveTracking(request());
  assert.equal(response.status, 200);
  assert.equal(db.writes[0].batchYear, 2026);
  assert.equal(db.writes[0].entryDate, null);
});


const archiveRoute = 'app/api/product-trackings/[id]/attachments/archive/route.ts';
const archiveRequest = (kind = 'INVOICE', id = '9') => [new Request(`http://localhost/api/product-trackings/${id}/attachments/archive?kind=${kind}`), {params: Promise.resolve({id})}] as const;

test('single tracking download enforces scope and attachment disposition while retaining inline support', async () => {
  const api = load('app/api/product-tracking-attachments/[id]/route.ts', {productTrackingAttachment: {findFirst: async ({where}: any) => {
    assert.equal(where.tracking.workspaceId, 2); assert.equal(where.tracking.companyId, 3);
    return {path: 'invoices/file.pdf', originalName: 'fattura è.pdf', mimeType: 'application/pdf'};
  }}}, {attachments: {...attachmentTools, readExpenseAttachment: async () => Buffer.from('%PDF-test')}});
  const options = () => ({params: Promise.resolve({id: '4'})});
  const download = await api.GET(new Request('http://localhost/api/product-tracking-attachments/4?download=1'), options());
  assert.equal(download.status, 200);
  assert.match(download.headers.get('Content-Disposition'), /^attachment;/);
  assert.match(download.headers.get('Content-Disposition'), /filename\*=UTF-8''fattura%20%C3%A8.pdf/);
  assert.equal(await download.text(), '%PDF-test');
  const inline = await api.GET(new Request('http://localhost/api/product-tracking-attachments/4'), options());
  assert.match(inline.headers.get('Content-Disposition'), /^inline;/);
});

test('tracking archives include only the requested category in the current workspace and company', async () => {
  for (const kind of ['INVOICE', 'TRACKING']) {
    const api = load(archiveRoute, {productTracking: {findFirst: async (query: any) => {
      assert.equal(query.where.id, 9); assert.equal(query.where.workspaceId, 2); assert.equal(query.where.companyId, 3);
      assert.equal(query.select.attachments.where.kind, kind);
      return {attachments: [{id: 1, originalName: '../documento.pdf', path: 'first', sizeBytes: 4, createdAt: new Date()}, {id: 2, originalName: 'documento.pdf', path: 'second', sizeBytes: 4, createdAt: new Date()}]};
    }}}, {attachments: {...attachmentTools, readExpenseAttachment: async (name: string) => Buffer.from(name)}});
    const response = await api.GET(...archiveRequest(kind));
    assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'application/zip');
    assert.match(response.headers.get('Content-Disposition'), /attachment; filename="tracciatura-9-/);
    const zip = Buffer.from(await response.arrayBuffer());
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    assert.equal(zip.readUInt16LE(zip.length - 14), 2);
    assert.ok(zip.includes(Buffer.from('1-documento.pdf'))); assert.ok(zip.includes(Buffer.from('2-documento.pdf')));
    assert.equal(zip.includes(Buffer.from('../')), false);
    assert.ok(zip.includes(Buffer.from('first'))); assert.ok(zip.includes(Buffer.from('second')));
  }
});

test('tracking archives reject unauthenticated, invalid, foreign and empty requests without reading files', async () => {
  let queries = 0, reads = 0;
  const db = {productTracking: {findFirst: async () => {queries++; return null;}}};
  const options = {attachments: {...attachmentTools, readExpenseAttachment: async () => {reads++; return Buffer.from('file');}}};
  assert.equal((await load(archiveRoute, db, {...options, denied: true}).GET(...archiveRequest())).status, 401);
  for (const [kind, id] of [['BAD', '9'], ['INVOICE', '0'], ['TRACKING', 'invalid']]) {
    assert.equal((await load(archiveRoute, db, options).GET(...archiveRequest(kind, id))).status, 400);
  }
  assert.equal(queries, 0);
  assert.equal((await load(archiveRoute, db, options).GET(...archiveRequest())).status, 404);
  const empty = {productTracking: {findFirst: async () => ({attachments: []})}};
  assert.equal((await load(archiveRoute, empty, options).GET(...archiveRequest())).status, 404);
  assert.equal(reads, 0);
});

test('tracking archives never return a partial ZIP if a file is missing or the size limit is exceeded', async () => {
  const attachments = [{id: 1, originalName: 'first.pdf', path: 'first', sizeBytes: 1}, {id: 2, originalName: 'second.pdf', path: 'second', sizeBytes: 1}];
  const db = {productTracking: {findFirst: async () => ({attachments})}};
  const missing = load(archiveRoute, db, {attachments: {...attachmentTools, readExpenseAttachment: async (name: string) => {if (name === 'second') throw Error('missing'); return Buffer.from('file');}}});
  assert.equal((await missing.GET(...archiveRequest())).status, 404);
  const oversized = load(archiveRoute, db, {attachments: {...attachmentTools, readExpenseAttachment: async () => ({byteLength: 51 * 1024 * 1024})}});
  assert.equal((await oversized.GET(...archiveRequest())).status, 413);
});

const bulkRoute = 'app/api/product-trackings/bulk/route.ts';
function bulkRequest(action: string, ids: string[] = ['9', '10']) {
  const data = new FormData(); data.set('bulkAction', action); ids.forEach(id => data.append('ids', id));
  return new Request('http://localhost/api/product-trackings/bulk', {method: 'POST', body: data});
}

test('bulk download scopes every selected tracking and creates category-specific safe ZIP paths', async () => {
  for (const action of ['documents', 'invoices']) {
    const api = load(bulkRoute, {productTracking: {findMany: async (query: any) => {
      assert.deepEqual(Array.from(query.where.id.in), [9, 10]);
      assert.equal(query.where.workspaceId, 2); assert.equal(query.where.companyId, 3);
      assert.equal(query.include.attachments.where.kind, action === 'invoices' ? 'INVOICE' : 'TRACKING');
      return [9, 10].map(id => ({id, attachments: [{id, path: `${id}.pdf`, originalName: '../../doc.pdf', sizeBytes: 4, createdAt: new Date()}]}));
    }}}, {attachments: {...attachmentTools, readExpenseAttachment: async () => Buffer.from('test')}});
    const response = await api.POST(bulkRequest(action, ['9', '10', '9']));
    assert.equal(response.status, 200);
    const zip = Buffer.from(await response.arrayBuffer());
    assert.ok(zip.includes(Buffer.from('tracciatura-9/9-doc.pdf')));
    assert.ok(zip.includes(Buffer.from('tracciatura-10/10-doc.pdf')));
    assert.equal(zip.includes(Buffer.from('../')), false);
  }
});

test('bulk rejects invalid selection and inaccessible records before reading files or deleting', async () => {
  const db = {productTracking: {findMany: async () => []}, $transaction: async (fn: any) => fn({$queryRaw: async () => [], productTracking: {findMany: async () => [], deleteMany() {assert.fail('No deletion');}}})};
  const api = load(bulkRoute, db, {attachments: {...attachmentTools, readExpenseAttachment() {assert.fail('No file reads');}}});
  for (const [action, ids] of [['documents', []], ['documents', ['0']], ['delete', ['bad']], ['invalid', ['9']]] as [string, string[]][]) {
    assert.equal((await api.POST(bulkRequest(action, ids))).status, 400);
  }
  for (const action of ['delete', 'documents', 'invoices']) assert.equal((await api.POST(bulkRequest(action))).status, 404);
  assert.equal((await load(bulkRoute, db, {denied: true}).POST(bulkRequest('documents'))).status, 401);
});

test('bulk deletion is scoped, audited and cleans attachment files after the transaction', async () => {
  const calls: string[] = [];
  const tx = {$queryRaw: async () => [], productTracking: {
    findMany: async ({where}: any) => {assert.equal(where.workspaceId, 2); assert.equal(where.companyId, 3); return [9, 10].map(id => ({id, attachments: [{path: `${id}.pdf`}]}));},
    deleteMany: async () => {calls.push('delete'); return {count: 2};},
  }};
  const api = load(bulkRoute, {$transaction: async (fn: any) => {const result = await fn(tx); calls.push('commit'); return result;}}, {
    audit: async (input: any, client: any) => {assert.equal(client, tx); assert.equal(input.action, 'BULK_DELETE'); calls.push('audit');},
    attachments: {...attachmentTools, deleteExpenseAttachmentFile: async (path: string) => {calls.push(path);}},
  });
  assert.equal((await api.POST(bulkRequest('delete'))).status, 200);
  assert.deepEqual(calls, ['delete', 'audit', 'commit', '9.pdf', '10.pdf']);
});

test('bulk ZIP fails without partial download when files are missing or exceed the limit', async () => {
  const db = {productTracking: {findMany: async () => [{id: 9, attachments: [{id: 1, path: 'a', originalName: 'a.pdf', sizeBytes: 1}]}]}};
  const missing = load(bulkRoute, db, {attachments: {...attachmentTools, readExpenseAttachment: async () => {throw Error('missing');}}});
  assert.equal((await missing.POST(bulkRequest('documents', ['9']))).status, 404);
  const huge = load(bulkRoute, db, {attachments: {...attachmentTools, readExpenseAttachment: async () => ({byteLength: 51 * 1024 * 1024})}});
  assert.equal((await huge.POST(bulkRequest('documents', ['9']))).status, 413);
});


test('read-only users may download but cannot bulk-delete', async () => {
  let queried = false;
  const api = load(bulkRoute, {productTracking: {findMany: async () => {queried = true; return [];}}}, {apiDenied: true});
  assert.equal((await api.POST(bulkRequest('delete'))).status, 403);
  assert.equal(queried, false);
  assert.equal((await api.POST(bulkRequest('documents'))).status, 404);
  assert.equal(queried, true);
});
