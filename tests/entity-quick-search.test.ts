import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesEntityQuickSearch} from '../lib/entity-quick-search';

test('la ricerca rapida trova nome o descrizione senza distinguere maiuscole', () => {
  assert.equal(matchesEntityQuickSearch('acme', 'ACME S.r.l.', 'Canone mensile'), true);
  assert.equal(matchesEntityQuickSearch('canone', 'Altro fornitore', 'Canone mensile'), true);
  assert.equal(matchesEntityQuickSearch('inesistente', 'ACME S.r.l.', 'Canone mensile'), false);
});

test('la ricerca rapida gestisce valori assenti e query vuota', () => {
  assert.equal(matchesEntityQuickSearch('stipendio', null, 'Stipendio agosto'), true);
  assert.equal(matchesEntityQuickSearch('cassa', undefined, null), false);
  assert.equal(matchesEntityQuickSearch('  ', undefined, null), true);
});
