import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { File } from 'node:buffer';
import {
  AttachmentValidationError,
  maxExpenseAttachmentBytes,
  saveExpenseAttachmentFiles
} from '../lib/attachments';

function asFormFile(file: File) {
  return file as unknown as globalThis.File;
}

test('salva un PDF valido nell’area privata con nome non prevedibile', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tabularium-attachments-'));
  process.env.UPLOADS_DIR = directory;
  try {
    const file = new File([Buffer.from('%PDF-1.7\nfixture')], 'fattura.pdf', { type: 'application/pdf' });
    const [saved] = await saveExpenseAttachmentFiles([asFormFile(file)]);
    assert.match(saved.path, /^invoices\/[0-9a-f-]+\.pdf$/);
    assert.equal(saved.originalName, 'fattura.pdf');
    assert.equal((await readFile(path.join(directory, saved.path))).subarray(0, 5).toString(), '%PDF-');
  } finally {
    delete process.env.UPLOADS_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});

test('rifiuta estensioni e contenuti che non corrispondono', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tabularium-attachments-'));
  process.env.UPLOADS_DIR = directory;
  try {
    const executable = new File([Buffer.from('MZ')], 'documento.exe', { type: 'application/octet-stream' });
    await assert.rejects(() => saveExpenseAttachmentFiles([asFormFile(executable)]), AttachmentValidationError);

    const fakePdf = new File([Buffer.from('non è un pdf')], 'documento.pdf', { type: 'application/pdf' });
    await assert.rejects(() => saveExpenseAttachmentFiles([asFormFile(fakePdf)]), AttachmentValidationError);
  } finally {
    delete process.env.UPLOADS_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});

test('rifiuta allegati oltre 10 MB', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tabularium-attachments-'));
  process.env.UPLOADS_DIR = directory;
  try {
    const oversized = new File(
      [Buffer.alloc(maxExpenseAttachmentBytes + 1, 0x20)],
      'fattura.pdf',
      { type: 'application/pdf' }
    );
    await assert.rejects(() => saveExpenseAttachmentFiles([asFormFile(oversized)]), AttachmentValidationError);
  } finally {
    delete process.env.UPLOADS_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});
