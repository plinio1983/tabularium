/** Exports the current search independently of the list's selected checkboxes. */
export default function SearchExportButton({entity, returnTo, disabled = false}: {
  entity: 'expenses' | 'incomes'; returnTo: string; disabled?: boolean;
}) {
  const listUrl = new URL(decodeURIComponent(returnTo), 'http://localhost');
  const params = new URLSearchParams(listUrl.search);
  for (const key of ['mobileList', 'new', 'editId', 'copyId', 'saved', 'error', 'ids', 'bulkAction']) params.delete(key);
  const href = `/api/exports/${entity}${params.size ? `?${params}` : ''}`;
  return <a className={`bulk-direct-link${disabled ? ' is-disabled' : ''}`} href={disabled ? undefined : href}
    data-bulk-search-export aria-disabled={disabled ? 'true' : undefined} aria-label="Esporta tutti i risultati della ricerca in CSV"
    title="Esporta tutti i risultati della ricerca">
    <span className="btn-icon" aria-hidden="true">⇩</span><span className="hidden-sm-down">Esporta CSV</span>
  </a>;
}
