import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTrackingDate, sixMonthsAgo, trackingFlags} from '../lib/product-tracking';
test('invoice date is mandatory and rejects impossible dates', () => {
 assert.throws(() => parseTrackingDate('', true), /obbligatoria/);
 assert.throws(() => parseTrackingDate('2026-02-30', true), /non valida/);
 assert.throws(() => parseTrackingDate('2026-13-01'), /non valida/);
 assert.equal(parseTrackingDate('2024-02-29', true)?.toISOString(), '2024-02-29T00:00:00.000Z');
 assert.equal(parseTrackingDate(''), null);
});
test('six calendar months clamps month-end and uses company day', () => {
 assert.equal(sixMonthsAgo('Europe/Rome', new Date('2026-08-31T12:00:00Z')).toISOString().slice(0,10), '2026-02-28');
 assert.equal(sixMonthsAgo('Europe/Rome', new Date('2026-10-12T22:30:00Z')).toISOString().slice(0,10), '2026-04-13');
});
test('missing documents and age indicators are independent, latest invoice wins', () => {
 const cutoff = new Date('2026-04-13');
 assert.deepEqual(trackingFlags({entryDate: null, attachments: []}, cutoff), {missingInvoice: true, missingTracking: true, oldInvoice: false, oldEntry: false});
 const record = {entryDate: new Date('2026-04-12'), attachments: [{kind: 'INVOICE', invoiceDate: new Date('2025-01-01')}, {kind: 'INVOICE', invoiceDate: cutoff}, {kind: 'TRACKING', invoiceDate: null}]};
 assert.deepEqual(trackingFlags(record, cutoff), {missingInvoice: false, missingTracking: false, oldInvoice: false, oldEntry: true});
 record.attachments.pop(); record.attachments.pop();
 assert.equal(trackingFlags(record, cutoff).oldInvoice, true);
});

test('missing entry date and entry period filters combine instead of overriding the period', async () => {
 const {trackingEntryDateWhere} = await import('../lib/product-tracking');
 const from = new Date('2026-01-01');
 assert.deepEqual(trackingEntryDateWhere(from, null, true), {AND: [{entryDate: null}, {entryDate: {gte: from}}]});
 assert.deepEqual(trackingEntryDateWhere(null, null, true), {entryDate: null});
 assert.deepEqual(trackingEntryDateWhere(from, null, false), {entryDate: {gte: from}});
});
