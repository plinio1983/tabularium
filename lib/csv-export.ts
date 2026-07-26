type CsvValue = string | number | boolean | Date | null | undefined | { toString(): string };

function csvText(value: CsvValue) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'Sì' : 'No';
  return String(value);
}

function safeSpreadsheetCell(value: CsvValue) {
  const text = csvText(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function escapeCsv(value: CsvValue) {
  const text = safeSpreadsheetCell(value).replaceAll('"', '""');
  return `"${text}"`;
}

export function createCsv(headers: string[], rows: CsvValue[][]) {
  const lines = [
    headers.map(escapeCsv).join(';'),
    ...rows.map(row => row.map(escapeCsv).join(';'))
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function csvDownload(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
