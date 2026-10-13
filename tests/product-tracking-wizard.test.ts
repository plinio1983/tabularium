import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrackingStep, trackingDocumentError} from '../lib/product-tracking-wizard';

test('only the three supported entry steps are accepted', () => {
  assert.equal(normalizeTrackingStep('3'), 3);
  for (const value of [undefined, 0, 4, -1, 'invalid', 2.5]) assert.equal(normalizeTrackingStep(value), 1);
});
test('the tracking step can be skipped empty but validates count, size and type before advancing', () => {
  assert.equal(trackingDocumentError(0, []), '');
  assert.equal(trackingDocumentError(4, [{name: 'tracking.PDF', size: 100}]), '');
  assert.match(trackingDocumentError(5, [{name: 'tracking.pdf', size: 100}]), /massimo 5/);
  assert.match(trackingDocumentError(0, [{name: 'tracking.pdf', size: 0}]), /vuoto/);
  assert.match(trackingDocumentError(0, [{name: 'tracking.pdf', size: 10 * 1024 * 1024 + 1}]), /10 MB/);
  assert.match(trackingDocumentError(0, [{name: 'tracking.exe', size: 100}]), /Formato/);
});
