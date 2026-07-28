const categoryTones: Record<string, string> = {
  SBANC: 'tone-bank-services',
  ASSIC: 'tone-insurance',
  AFFUT: 'tone-rent',
  WEB: 'tone-web',
  SPED: 'tone-shipping',
  TAX: 'tone-taxes',
  ALSRV: 'tone-services',
  MERCE: 'tone-goods',
  SUPP: 'tone-support',
  PERS: 'tone-staff',
  RATE: 'tone-installment'
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

export const vatStylesNoText: Record<string, { label: string; className: string }> = {
  '0': { label: '0%', className: 'tone-vat-0' },
  '4': { label: '4%', className: 'tone-vat-4' },
  '10': { label: '10%', className: 'tone-vat-10' },
  '22': { label: '22%', className: 'tone-vat-22' }
};

export const invoiceStatusStyles: Record<string, { label: string; icon: string; className: string }> = {
  NON_PREVISTA: { label: 'NP', icon: '✕', className: 'tone-neutral' },
  IN_ATTESA: { label: 'Attesa', icon: '⏳', className: 'tone-waiting' },
  INVIATA_SDI: { label: 'Emessa', icon: '✅', className: 'tone-received' },
  CONTESTAZIONE: { label: 'Contesto', icon: '⚠️', className: 'tone-dispute' },
  RICEVUTA: { label: 'Emessa', icon: '✅', className: 'tone-received' },
  NONE: { label: 'Non impostato', icon: '  •  ', className: 'tone-neutral' },
  YES: { label: 'Si', icon: '✓', className: 'tone-yes' },
  NO: { label: 'No', icon: '×', className: 'tone-no' },
  OK: { label: 'Ok', icon: '✓', className: 'tone-yes' },
  KO: { label: 'Ko', icon: '×', className: 'tone-no' }
};

type CategoryDisplay = { name?: string | null; code?: string | null; icon?: string | null };

export function categoryIcon(category?: CategoryDisplay | null) {
  return category?.icon || '';
}

export function categoryTone(category?: CategoryDisplay | null) {
  return category?.code ? categoryTones[category.code] : undefined;
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

export function vatRateLabel(value: { toString(): string } | number | null | undefined) {
  if (value === null || value === undefined) return '-';
  const rate = Number(value.toString());
  return Number.isFinite(rate) ? `${rate.toLocaleString('it-IT')}%` : '-';
}

export function formatPeriod(month: number, year: number) {
  const monthName = new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(year, month - 1, 1));
  const normalized = monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '');
  return `${normalized} ${year}`;
}
