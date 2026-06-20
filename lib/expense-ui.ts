export const categoryStyles: Record<string, { icon: string; className: string; acronym: string }> = {
  'Servizi Bancari': { icon: '🏦', acronym: 'SBANC', className: 'tone-bank-services' },
  'Assicurazioni': { icon: '🛡️', acronym: 'ASSIC', className: 'tone-insurance' },
  'Affitti/Utenze': { icon: '🏠', acronym: 'AFFUT', className: 'tone-rent' },
  'Servizi Web': { icon: '🌐', acronym: 'WEB', className: 'tone-web' },
  'Spedizioni/Corrieri': { icon: '🚚', acronym: 'SPED', className: 'tone-shipping' },
  'Tasse/Imposte': { icon: '🧾', acronym: 'TAX', className: 'tone-taxes' },
  'Altri Servizi': { icon: '🧰', acronym: 'ALSRV', className: 'tone-services' },
  'Merce/Forniture': { icon: '📦', acronym: 'MERCE', className: 'tone-goods' },
  'Articoli di Supporto': { icon: '🧩', acronym: 'SUPP', className: 'tone-support' },
  'Prestazioni/Dipendenti': { icon: '👥', acronym: 'PERS', className: 'tone-staff' },
  'Rateizzazione': { icon: '📆', acronym: 'RATE', className: 'tone-installment' }
};

export const paymentStatusStyles: Record<string, { label: string; icon: string; className: string }> = {
  DA_PAGARE: { label: 'Non pagato', icon: '⏳', className: 'tone-waiting' },
  COMPLETATO: { label: 'Completato', icon: '✅', className: 'tone-paid' },
  PAGATO_PARZIALMENTE: { label: 'Pagato parzialmente', icon: '🟡', className: 'tone-partial' },
  SCADUTO: { label: 'SCADUTO', icon: '⛔', className: 'tone-critical' }
};

export const yesNoStyles = {
  yes: { label: 'Si', icon: '✓', className: 'tone-yes' },
  no: { label: 'No', icon: '×', className: 'tone-no' }
};

export const vatStyles: Record<string, { label: string; className: string }> = {
  '0': { label: 'IVA 0%', className: 'tone-vat-0' },
  '4': { label: 'IVA 4%', className: 'tone-vat-4' },
  '10': { label: 'IVA 10%', className: 'tone-vat-10' },
  '22': { label: 'IVA 22%', className: 'tone-vat-22' }
};

export const invoiceStatusStyles: Record<string, { label: string; icon: string; className: string }> = {
  NON_PREVISTA: { label: 'N.P.', icon: '—', className: 'tone-neutral' },
  IN_ATTESA: { label: 'In attesa', icon: '⏳', className: 'tone-waiting' },
  INVIATA_SDI: { label: 'Emessa', icon: '✅', className: 'tone-received' },
  CONTESTAZIONE: { label: 'Contestazione', icon: '⚠️', className: 'tone-dispute' },
  RICEVUTA: { label: 'Emessa', icon: '✅', className: 'tone-received' },
  NONE: { label: 'Non impostato', icon: '•', className: 'tone-neutral' },
  YES: { label: 'Si', icon: '✓', className: 'tone-yes' },
  NO: { label: 'No', icon: '×', className: 'tone-no' },
  OK: { label: 'Ok', icon: '✓', className: 'tone-yes' },
  KO: { label: 'Ko', icon: '×', className: 'tone-no' }
};

export const bankIcons: Record<string, string> = {
  MyTu: '🏦',
  Unicredit: '🏛️',
  Wise: '🌍',
  'Altra Banca': '💳'
};

type CategoryDisplay = { name?: string | null; code?: string | null; icon?: string | null };

export function categoryIcon(category?: CategoryDisplay | null) {
  return category?.icon || '';
}

export function categoryTone(category?: CategoryDisplay | null) {
  return category?.name ? categoryStyles[category.name]?.className : undefined;
}

export function categoryLabel(category: CategoryDisplay, value = category.name ?? '') {
  const icon = categoryIcon(category);
  return `${icon ? `${icon} ` : ''}${value}`;
}

export function badgeClass(className?: string) {
  return `badge color-badge ${className ?? 'tone-neutral'}`;
}

export function vatKey(value: unknown) {
  const numberValue = Number(String(value ?? 0));
  return String(numberValue).replace(/\.00$/, '');
}

export function formatPeriod(month: number, year: number) {
  const monthName = new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(year, month - 1, 1));
  const normalized = monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '');
  return `${normalized} ${year}`;
}
