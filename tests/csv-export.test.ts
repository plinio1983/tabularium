import assert from 'node:assert/strict';
import test from 'node:test';
import { createCsv } from '../lib/csv-export';

test('createCsv genera un CSV UTF-8 compatibile con Excel', () => {
  const csv = createCsv(
    ['Nome', 'Importo', 'Attivo'],
    [['Mario, Rossi', '12,50', true]]
  );

  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Nome";"Importo";"Attivo"/);
  assert.match(csv, /"Mario, Rossi";"12,50";"Sì"/);
  assert.ok(csv.endsWith('\r\n'));
});

test('createCsv neutralizza le formule nei dati esportati', () => {
  const csv = createCsv(['Valore'], [['=HYPERLINK("https://example.test")'], ['+1+1'], ['-2+3'], ['@SUM(1;2)']]);

  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/);
  assert.match(csv, /"'\+1\+1"/);
  assert.match(csv, /"'-2\+3"/);
  assert.match(csv, /"'@SUM\(1;2\)"/);
});
