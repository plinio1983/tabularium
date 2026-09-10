import {createCsv} from './csv-export';

export const receiptCsvHeaders = ['Versione', 'Identificativo origine', 'Data e ora', 'Descrizione', 'Importo', 'Fiscale', 'IVA %', 'Codice canale', 'Canale di vendita', 'Metodo pagamento', 'Banca', 'Periodo contabile', 'Note'] as const;
export const receiptCsvLimit = 1000;
export type ReceiptCsvRow = {
  origin: string; date: string; description: string; amount: string; fiscal: boolean; vat: string;
  channelCode: string; channel: string; method: string; bank: string; period: string; notes: string;
};
export type ParsedReceiptRow = {line: number; row?: ReceiptCsvRow; error?: string};

// Escape literal leading apostrophes too, so spreadsheet protection is reversible.
const protectText = (text: string) => /^['=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
const unprotectText = (text: string) => /^'['=+\-@\t\r\n]/.test(text) ? text.slice(1) : text;
export function exportReceiptCsv(rows: ReceiptCsvRow[]) {
  return createCsv([...receiptCsvHeaders], rows.map(row => [
    '1', protectText(row.origin), row.date, protectText(row.description), row.amount.replace('.', ','), row.fiscal,
    row.vat, protectText(row.channelCode), protectText(row.channel), protectText(row.method), protectText(row.bank), row.period, protectText(row.notes),
  ]));
}

function csvRecords(input: string) {
  const text = input.replace(/^\uFEFF/, '');
  const records: {line: number; cells: string[]}[] = [];
  let cells: string[] = [], cell = '', quoted = false, closed = false, line = 1, start = 1;
  const finish = () => {cells.push(cell); if (cells.some(value => value !== '')) records.push({line: start, cells}); cells = []; cell = ''; closed = false;};
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {if (text[i + 1] === '"') {cell += '"'; i++;} else {quoted = false; closed = true;}}
      else {cell += char; if (char === '\n') line++;}
    } else if (char === '"') {
      if (cell || closed) throw new Error(`Virgolette non valide alla riga ${line}.`);
      quoted = true;
    } else if (char === ';') {cells.push(cell); cell = ''; closed = false;}
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finish(); line++; start = line;
    } else {
      if (closed) throw new Error(`Separatore non valido alla riga ${line}: usa il punto e virgola.`);
      cell += char;
    }
  }
  if (quoted) throw new Error('Campo tra virgolette non chiuso.');
  if (cell || cells.length || closed) finish();
  return records;
}

export function parseReceiptCsv(input: string): ParsedReceiptRow[] {
  const records = csvRecords(input);
  const header = records.shift()?.cells.map(value => value.trim());
  if (!header || header.length !== receiptCsvHeaders.length || !receiptCsvHeaders.every((name, index) => header[index] === name)) throw new Error('Colonne non valide. Usa il modello CSV Scontrini o un file esportato dalla lista Scontrini.');
  if (!records.length) throw new Error('Il file non contiene scontrini.');
  if (records.length > receiptCsvLimit) throw new Error(`Sono consentiti al massimo ${receiptCsvLimit} scontrini per file.`);
  return records.map(({line, cells}) => {
    try {
      if (cells.length !== header.length) throw new Error('Numero di colonne non valido.');
      const [version, rawOrigin, rawDate, rawDescription, rawAmount, rawFiscal, rawVat, rawCode, rawChannel, rawMethod, rawBank, rawPeriod, rawNotes] = cells;
      if (version !== '1') throw new Error('Versione CSV non supportata.');
      const origin = unprotectText(rawOrigin).trim();
      if (!origin || origin.length > 180 || /[\r\n\u0000]/.test(origin)) throw new Error('Identificativo origine obbligatorio, massimo 180 caratteri.');
      const date = rawDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('Data e ora non valide: usa ISO con fuso, ad esempio 2026-09-10T14:30:00+02:00.');
      const calendar = new Date(`${date.slice(0, 10)}T00:00:00Z`);
      if (calendar.toISOString().slice(0, 10) !== date.slice(0, 10) || Number(date.slice(11, 13)) > 23) throw new Error('Data e ora non valide.');
      const amountText = rawAmount.trim().replace(',', '.');
      if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) throw new Error('Importo positivo richiesto, massimo due decimali e nessun separatore delle migliaia.');
      const amount = `${BigInt(amountText.split('.')[0])}.${(amountText.split('.')[1] ?? '').padEnd(2, '0')}`;
      const fiscalText = rawFiscal.trim().toLowerCase();
      if (!['sì', 'si', 'no', 'true', 'false'].includes(fiscalText)) throw new Error('Fiscale deve essere Sì o No.');
      const fiscal = ['sì', 'si', 'true'].includes(fiscalText);
      const vat = rawVat.trim().replace(',', '.');
      if (!/^(0|4|10|22)(?:\.0{1,2})?$/.test(vat) || (!fiscal && Number(vat) !== 0)) throw new Error('IVA ammessa: 0, 4, 10, 22; per i non fiscali deve essere 0.');
      const period = rawPeriod.trim();
      if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Periodo contabile richiesto nel formato AAAA-MM (1900–2199).');
      const description = unprotectText(rawDescription), notes = unprotectText(rawNotes);
      if (description.length > 200 || notes.length > 10000 || cells.some(value => value.includes('\u0000'))) throw new Error('Testo troppo lungo o caratteri non validi.');
      const channelCode = unprotectText(rawCode).trim(), channel = unprotectText(rawChannel).trim(), method = unprotectText(rawMethod).trim(), bank = unprotectText(rawBank).trim();
      if ((!channelCode && !channel) || !method || !bank) throw new Error('Canale, metodo e banca sono obbligatori.');
      return {line, row: {origin, date: new Date(date).toISOString(), description, amount, fiscal, vat: String(Number(vat)), channelCode, channel, method, bank, period, notes}};
    } catch (error) {return {line, error: error instanceof Error ? error.message : 'Riga non valida.'};}
  });
}

export function receiptOrigin(item: {id: number; workspaceId: number | null; companyId: number; cashRegisterRequestId: string | null}) {
  const key = item.cashRegisterRequestId;
  const prefix = `csv:${item.companyId}:`;
  return key?.startsWith(prefix) ? key.slice(prefix.length) : key ? `request:${key}` : `legacy:${item.workspaceId}:${item.companyId}:${item.id}`;
}
export const receiptImportKey = (companyId: number, origin: string) => `csv:${companyId}:${origin}`;
