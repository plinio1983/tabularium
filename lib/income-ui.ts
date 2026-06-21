export const salesChannelStyles: Record<string, { label: string; icon: string; className: string }> = {
  Shop: { label: 'Shop', icon: '🏬', className: 'tone-goods' },
  'Online Shop': { label: 'Online Shop', icon: '🛒', className: 'tone-web' },
  'Altro Canale': { label: 'Altro Canale', icon: '➕', className: 'tone-services' }
};

export const saleCategoryStyles: Record<string, { label: string; icon: string; className: string }> = {
  B2C: { label: 'B2C', icon: '👤', className: 'tone-yes' },
  B2B: { label: 'B2B', icon: '🏢', className: 'tone-bank-services' },
  Altro: { label: 'Altro', icon: '•', className: 'tone-neutral' }
};

export const paymentMethodStyles: Record<string, { icon: string; className: string }> = {
  Bonifico: { icon: '🏦', className: 'tone-bank-services' },
  'Carta di Debito/Credito': { icon: '💳', className: 'tone-paid' },
  Criptovaluta: { icon: '₿', className: 'tone-vat-10' },
  Stripe: { icon: '◈', className: 'tone-web' },
  Cash: { icon: '💶', className: 'tone-goods' }
};

export const creditChannelStyles: Record<string, { icon: string; className: string }> = {
  Cash: { icon: '💶', className: 'tone-goods' },
  Unicredit: { icon: '🏛️', className: 'tone-bank-services' },
  MyTu: { icon: '🏦', className: 'tone-paid' },
  Wise: { icon: '🌍', className: 'tone-web' }
};

export const fiscalStyles = {
  yes: { label: 'Si', icon: '✓', className: 'tone-yes' },
  no: { label: 'No', icon: '×', className: 'tone-no' }
};

export const incomeInvoiceStatusStyles: Record<string, { label: string; icon: string; className: string }> = {
  NON_INVIATA: { label: 'Non inviata', icon: '⏳', className: 'tone-waiting' },
  EMESSA: { label: 'Emessa', icon: '✅', className: 'tone-received' },
  NONE: { label: '-', icon: '•', className: 'tone-neutral' }
};

export const incomeCreditStatusStyles: Record<string, { label: string; icon: string; className: string }> = {
  ACCREDITATO: { label: 'Accreditato', icon: '✓', className: 'tone-yes' },
  DA_ACCREDITARE: { label: 'Da accreditare', icon: '⏳', className: 'tone-waiting' },
  SCADUTO: { label: 'Scaduto', icon: '⛔', className: 'tone-critical' }
};

export function badgeClass(className?: string) {
  return `badge color-badge ${className ?? 'tone-neutral'}`;
}
