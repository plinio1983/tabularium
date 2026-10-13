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

const require = createRequire(import.meta.url);
const current = {workspace: {id: 2}, company: {id: 3}, user: {id: 4}};
function load(file: string, db: any, options: {denied?: boolean; attachments?: any; audit?: any; invoiceFile?: any} = {}) {
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
        return options.denied ? {ok: false, status: 403, error: 'Permessi insufficienti'} : {ok: true, current};
      },
      getWorkspaceContext: async () => options.denied ? null : current,
    },
    '@/lib/product-tracking': tracking,
    '@/lib/attachments': options.attachments ?? attachmentTools,
    '@/lib/product-tracking-invoice-file': options.invoiceFile ?? invoiceFileTools,
    '@/lib/audit': {writeAuditLog: options.audit ?? (async () => {})},
  };
  runInNewContext(source, {exports, require: (name: string) => mocks[name] ?? require(name), File, FormData, Error, Uint8Array,
    console: {error() {}}});
  return exports;
}
function request(files: {kind: string; name: string; content?: string; date?: string}[] = []) {
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001-A');
  let index = 0;
  for (const item of files) {
    form.append(item.kind, new File([item.content ?? '%PDF-1.7\nfixture'], item.name, {type: 'application/pdf'}));
    if (item.kind === 'INVOICE') {if (item.date) form.set(`invoiceDate-new-${index}`, item.date); index++;}
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
  const files = Array.from({length: 5}, (_, i) => ({kind: 'INVOICE', name: `invoice-${i}.pdf`, date: `2026-01-0${i + 1}`})).concat(Array.from({length: 5}, (_, i) => ({kind: 'TRACKING', name: `tracking-${i}.pdf`, date: ''})));
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
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.append('removedIds', '12');
  assert.equal((await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}), 9)).status, 200);
  assert.deepEqual(deletedPaths, ['test-fixture.pdf']);
});

test('an attachment from another tracking cannot be removed through an edited record', async () => {
  const db = database({id: 9, attachments: []});
  const service = load('lib/product-tracking-save.ts', db);
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.append('removedIds', '999');
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
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001'); form.set('invoiceDate-12', '2026-01-01');
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

function documentRequest() {
  const form = new FormData(); form.append('document', new File(['%PDF-1.7\ntracking'], 'tracking.pdf', {type: 'application/pdf'}));
  return new Request('http://localhost', {method: 'POST', body: form});
}
test('tracking document creation does not require or store an invoice date', async () => {
  const service = load('lib/product-tracking-attachment-service.ts', invoiceDatabase([], false, 'TRACKING'), {
    invoiceFile: {saveTrackingInvoiceFile: async () => ({path: 'tracking.pdf', originalName: 'tracking.pdf', sizeBytes: 100})},
  });
  const response = await service.mutateTrackingDocument(documentRequest(), 9);
  assert.equal(response.status, 200);
  const record = await response.json(); assert.equal(record.kind, 'TRACKING'); assert.equal(record.invoiceDate, null);
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
  assert.equal(record.id, 4); assert.equal(record.path, 'new-tracking.pdf'); assert.equal(record.invoiceDate, null);
  assert.deepEqual(removed, ['old-tracking.pdf']);
});

test('the full editor replaces tracking files under their original IDs without requiring dates', async () => {
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
  const form = new FormData(); form.set('name', 'Olio'); form.set('batch', '001');
  form.append('trackingReplacement-4', new File(['%PDF'], 'new-tracking.pdf'));
  assert.equal((await service.saveTracking(new Request('http://localhost', {method: 'POST', body: form}), 9)).status, 200);
  assert.equal(updates[0].where.id, 4); assert.equal(updates[0].data.path, 'new-tracking.pdf');
  assert.equal(updates[0].data.invoiceDate, null); assert.deepEqual(removed, ['old-tracking.pdf']);
});
