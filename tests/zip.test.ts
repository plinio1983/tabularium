import assert from 'node:assert/strict';
import test from 'node:test';
import {createZip} from '../lib/zip';

test('crea un archivio ZIP con nomi UTF-8 e directory per spesa', () => {
  const zip = createZip([
    {name: 'spesa-10/fattura.pdf', data: Buffer.from('%PDF-test')},
    {name: 'spesa-11/ricevuta è.pdf', data: Buffer.from('receipt')}
  ]);

  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 14), 2);
  assert.ok(zip.includes(Buffer.from('spesa-10/fattura.pdf')));
  assert.ok(zip.includes(Buffer.from('spesa-11/ricevuta è.pdf')));
  assert.ok(zip.includes(Buffer.from('%PDF-test')));
});
