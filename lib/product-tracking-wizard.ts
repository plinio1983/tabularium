export const trackingWizardSteps = [
  {title: 'Merce', description: 'Riferimento, lotto, nome e data ingresso.'},
  {title: 'Documenti di tracciamento', description: 'Aggiungi fino a 5 documenti di tracciamento oppure prosegui senza allegati.'},
  {title: 'Fatture', description: 'Aggiungi e conferma le fatture, poi salva la tracciatura.'},
] as const;

export function normalizeTrackingStep(value: unknown) {
  const step = Number(value);
  return Number.isInteger(step) && step >= 1 && step <= 3 ? step : 1;
}
export function trackingDocumentError(existingCount: number, files: {name: string; size: number}[]) {
  if (existingCount + files.length > 5) return 'Puoi allegare massimo 5 documenti di tracciamento.';
  for (const file of files) {
    if (!file.size) return `Il documento ${file.name} è vuoto.`;
    if (file.size > 10 * 1024 * 1024) return `Il documento ${file.name} supera il limite di 10 MB.`;
    if (!/\.(pdf|jpe?g|png|webp|xml|p7m)$/i.test(file.name)) return `Formato non consentito: ${file.name}.`;
  }
  return '';
}
