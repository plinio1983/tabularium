import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const maxExpenseAttachments = 5;
export const maxExpenseAttachmentBytes = 10 * 1024 * 1024;

const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.xml', '.p7m']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/xml',
  'text/xml',
  'application/pkcs7-mime',
  'application/x-pkcs7-mime',
  'application/octet-stream'
]);

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttachmentValidationError';
  }
}

function uploadsRoot() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads');
}

function hasExpectedSignature(extension: string, buffer: Buffer) {
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.jpg' || extension === '.jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (extension === '.xml') {
    const beginning = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').replace(/^\uFEFF/, '').trimStart();
    return beginning.startsWith('<?xml') || beginning.startsWith('<');
  }
  if (extension === '.p7m') return buffer[0] === 0x30;
  return false;
}

function safeDownloadName(name: string) {
  return path.basename(name).replace(/[\r\n"]/g, '_');
}

export async function saveExpenseAttachmentFiles(files: FormDataEntryValue[], existingCount = 0) {
  const remaining = Math.max(0, maxExpenseAttachments - existingCount);
  const candidates = files.filter((file): file is File => file instanceof File && file.size > 0).slice(0, remaining);
  if (!candidates.length) return [];

  const destination = path.join(uploadsRoot(), 'invoices');
  await mkdir(destination, { recursive: true, mode: 0o750 });

  const saved = [];
  for (const file of candidates) {
    const extension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.has(extension)) throw new AttachmentValidationError(`Formato allegato non consentito: ${file.name}`);
    if (file.size > maxExpenseAttachmentBytes) throw new AttachmentValidationError(`Allegato troppo grande: ${file.name}`);
    if (file.type && !allowedMimeTypes.has(file.type.toLowerCase())) throw new AttachmentValidationError(`Tipo allegato non consentito: ${file.name}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedSignature(extension, buffer)) throw new AttachmentValidationError(`Contenuto allegato non valido: ${file.name}`);

    const filename = `${randomUUID()}${extension}`;
    await writeFile(path.join(destination, filename), buffer, { mode: 0o640, flag: 'wx' });
    saved.push({
      originalName: safeDownloadName(file.name),
      path: `invoices/${filename}`,
      mimeType: file.type || null,
      sizeBytes: file.size
    });
  }
  return saved;
}

export async function readExpenseAttachment(storedPath: string) {
  const relativePath = storedPath.replace(/^\/?uploads\//, '').replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('..') || path.isAbsolute(relativePath)) {
    throw new AttachmentValidationError('Percorso allegato non valido');
  }

  try {
    return await readFile(path.join(uploadsRoot(), relativePath));
  } catch (error) {
    // Compatibilità locale con allegati creati prima dell'archiviazione privata.
    if (storedPath.startsWith('/uploads/')) {
      return readFile(path.join(process.cwd(), 'public', storedPath));
    }
    throw error;
  }
}

