const salesChannelToneOptions = ['tone-goods', 'tone-web', 'tone-services', 'tone-bank-services', 'tone-neutral'];

export function salesChannelTone(value: string) {
  const hash = Array.from(value).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return salesChannelToneOptions[hash % salesChannelToneOptions.length];
}

export const saleCategoryTones: Record<string, string> = {
  B2C: 'tone-yes',
  B2B: 'tone-bank-services',
  OTHER: 'tone-neutral'
};

export const fiscalStyles = {
  yes: { label: 'Si', icon: '✓', className: 'tone-yes' },
  no: { label: 'No', icon: '×', className: 'tone-no' }
};

export const incomeInvoiceStatusStyles: Record<string, { label: string; icon: string; className: string }> = {
  NON_INVIATA: { label: 'Non inviata', icon: '⏳', className: 'tone-waiting' },
  // EMESSA: { label: 'Emessa', icon: '✅', className: 'tone-received' },
  EMESSA: { label: 'Emessa', icon: '✓', className: 'tone-received' },
  NONE: { label: '', icon: '×', className: 'tone-neutral' }
};

export const incomeCreditStatusStyles: Record<string, { label: string; icon: string; className: string }> = {
  ACCREDITATO: { label: 'Accreditato', icon: '✓', className: 'tone-yes' },
  DA_ACCREDITARE: { label: 'Da accreditare', icon: '⏳', className: 'tone-waiting' },
  SCADUTO: { label: 'Scaduto', icon: '⛔', className: 'tone-critical' }
};

export function badgeClass(className?: string) {
  return `badge color-badge ${className ?? 'tone-neutral'}`;
}
