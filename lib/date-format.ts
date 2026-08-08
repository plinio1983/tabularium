export function formatItalianCompactDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;

  const parts = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(year, month - 1, day, 12));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  const monthLabel = part('month').replace('.', '');
  return `${part('day')} ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${part('year')}`;
}
