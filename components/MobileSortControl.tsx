"use client";

type MobileSortOption = {
  value: string;
  label: string;
};

type Props = {
  action: string;
  currentValue: string;
  options: MobileSortOption[];
  searchParams: Record<string, string | string[] | undefined>;
};

function optionLabel(option: MobileSortOption) {
  const label = option.label.replace(/^[↑↓]\s*/, '');
  if (option.value.endsWith('_asc')) return `↑ ${label}`;
  if (option.value.endsWith('_desc')) return `↓ ${label}`;
  return label;
}

export default function MobileSortControl({ action, currentValue, options, searchParams }: Props) {
  const selectedValue = options.some(option => option.value === currentValue) ? currentValue : options[0]?.value ?? '';
  const hiddenParams = Object.entries(searchParams).flatMap(([key, value]) => {
    if (key === 'mobileSort' || key === 'saved' || key === 'error' || key === 'usage') return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(item => [key, item] as const);
    return value ? [[key, value] as const] : [];
  });

  return <form className="mobile-sort-control" action={action}>
    {hiddenParams.map(([key, value], index) => <input type="hidden" name={key} value={value} key={`${key}-${index}`} />)}
    <label htmlFor={`${action.replace('/', '') || 'list'}MobileSort`}>Ordina per</label>
    <select id={`${action.replace('/', '') || 'list'}MobileSort`} name="mobileSort" defaultValue={selectedValue} aria-label="Ordina lista mobile" onChange={event => event.currentTarget.form?.requestSubmit()}>
      {options.map(option => <option value={option.value} key={option.value}>{optionLabel(option)}</option>)}
    </select>
  </form>;
}
