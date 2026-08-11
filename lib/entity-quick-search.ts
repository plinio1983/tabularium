function normalizeQuickSearchValue(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('it');
}

export function matchesEntityQuickSearch(query: unknown, ...values: unknown[]) {
  const normalizedQuery = normalizeQuickSearchValue(query);
  if (!normalizedQuery) return true;
  return values.some(value => normalizeQuickSearchValue(value).includes(normalizedQuery));
}
