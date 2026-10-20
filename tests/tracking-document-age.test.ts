import test from 'node:test';
import assert from 'node:assert/strict';
import {latestTrackingDocumentDate, trackingDocumentAge, trackingDocumentAgeClass} from '../lib/tracking-document-age';
import {dateInputInTimeZone} from '../lib/company-time';

const today = '2026-10-20';
const dateAgo = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);

test('document age follows the agreed day, week and 30-day month thresholds', () => {
  const cases: Array<[number, string]> = [[0, '0 giorni'], [1, '1 giorno'], [14, '14 giorni'], [15, '<3 sett'], [20, '<3 sett'], [21, '3 sett'], [27, '3 sett'], [28, '4 sett'], [29, '<1 Mese'], [30, '1 Mese'], [44, '1 Mese'], [45, '<2 mesi'], [59, '<2 mesi'], [60, '2 mesi'], [74, '2 mesi'], [75, '<3 mesi'], [89, '<3 mesi'], [90, '3 mesi'], [365, '12 mesi']];
  for (const [days, label] of cases) {
    assert.deepEqual(trackingDocumentAge(dateAgo(days), today), {date: dateAgo(days), days, label});
  }
});

test('latest document is selected by document date, ignoring missing or invalid dates', () => {
  assert.equal(latestTrackingDocumentDate([null, '2026-01-01', '2026-02-30', new Date('2026-10-15T00:00:00Z'), undefined, '2026-09-25']), '2026-10-15');
  assert.equal(latestTrackingDocumentDate([]), null);
  assert.equal(latestTrackingDocumentDate(['invalid', new Date(NaN), null]), null);
  assert.equal(trackingDocumentAge(null, today).label, 'Data mancante');
  assert.equal(trackingDocumentAge('2026-02-30', today).label, 'Data mancante');
  assert.equal(trackingDocumentAge('2026-10-21', today).label, 'Data futura');
});

test('age uses the company calendar date and remains accurate across DST', () => {
  const now = new Date('2026-10-20T22:30:00Z');
  assert.equal(trackingDocumentAge('2026-10-20', dateInputInTimeZone('Europe/Rome', now)).days, 1);
  assert.equal(trackingDocumentAge('2026-10-20', dateInputInTimeZone('UTC', now)).days, 0);
  assert.equal(trackingDocumentAge('2026-03-28', '2026-03-30').days, 2);
  assert.equal(trackingDocumentAge('2026-10-24', '2026-10-26').days, 2);
});


test('age uses a warning badge only beyond six 30-day months', () => {
  assert.equal(trackingDocumentAgeClass(trackingDocumentAge(dateAgo(180), today)), 'muted tracking-document-age');
  assert.match(trackingDocumentAgeClass(trackingDocumentAge(dateAgo(181), today)), /badge.*tone-warning/);
  assert.match(trackingDocumentAgeClass(trackingDocumentAge(dateAgo(365), today)), /tone-warning/);
  assert.equal(trackingDocumentAgeClass(trackingDocumentAge(null, today)), 'muted tracking-document-age');
  assert.equal(trackingDocumentAgeClass(trackingDocumentAge('2026-10-21', today)), 'muted tracking-document-age');
});
