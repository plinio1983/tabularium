import {createCsv} from './csv-export';
import {dateInputInTimeZone} from './company-time';
import {movementTypeLabels, type LedgerKind} from './movement-ledger';
import type {Movement} from './movement-ledger-data';

export const ledgerExportLimit = 5000;
export function movementLedgerCsv(kind: LedgerKind, rows: Movement[], timeZone: string) {
  return createCsv(
    ['ID movimento', 'Data', 'Importo', 'Metodo pagamento', 'Banca / conto', kind === 'payments' ? 'Beneficiario' : 'Cliente / canale', 'Descrizione', 'Tipo', kind === 'payments' ? 'ID spesa' : 'ID incasso'],
    rows.map(row => [row.id, row.date ? dateInputInTimeZone(timeZone, row.date) : '', row.amount.replace('.', ','), row.method, row.bank, row.party, row.description, movementTypeLabels[row.type] ?? row.type, row.documentId])
  );
}
