import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import { prisma } from '@/lib/prisma';
import { euro } from '@/lib/money';
import NewSupplierPanel from '@/components/NewSupplierPanel';
import ActionFeedbackBanner from '@/components/ActionFeedbackBanner';
import SupplierFiltersDrawer from '@/components/SupplierFiltersDrawer';
import SortableTableController from '@/components/SortableTableController';
import MobileSortControl from '@/components/MobileSortControl';
import { requireWorkspace } from '@/lib/auth';
import { stripFlashRecord, stripFlashSearchParams } from '@/lib/flash';
import { compareDate, compareNumber, compareText } from '@/lib/mobile-sort';

const supplierMobileSortOptions = [
  { value: 'businessName_asc', label: 'Ragione sociale (A-Z)' },
  { value: 'businessName_desc', label: 'Ragione sociale (Z-A)' },
  { value: 'alias_asc', label: 'Alias (A-Z)' },
  { value: 'alias_desc', label: 'Alias (Z-A)' },
  { value: 'email_asc', label: 'Email (A-Z)' },
  { value: 'vatNumber_asc', label: 'P.IVA (A-Z)' },
  { value: 'iban_asc', label: 'IBAN (A-Z)' },
  { value: 'pec_asc', label: 'PEC (A-Z)' },
  { value: 'taxCodeSdi_asc', label: 'Codice SDI/C.F. (A-Z)' },
  { value: 'internalNotes_asc', label: 'Note interne (A-Z)' },
  { value: 'openExpensesCount_desc', label: 'Ordini da saldare alti' },
  { value: 'openExpensesCount_asc', label: 'Ordini da saldare bassi' },
  { value: 'amountToPay_desc', label: 'Importo da saldare alto' },
  { value: 'amountToPay_asc', label: 'Importo da saldare basso' },
  { value: 'annualOrdersCount_desc', label: 'Ordini anno alti' },
  { value: 'annualOrdersCount_asc', label: 'Ordini anno bassi' },
  { value: 'annualPurchasedAmount_desc', label: 'Acquisti anno alti' },
  { value: 'annualPurchasedAmount_asc', label: 'Acquisti anno bassi' },
  { value: 'createdAt_desc', label: 'Creazione recente' },
  { value: 'updatedAt_desc', label: 'Aggiornamento recente' },
  // { value: 'id_desc', label: 'ID decrescente' },
  // { value: 'id_asc', label: 'ID crescente' }
];

function inputDefault(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function ActiveFilterSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  return <div className="active-filter-summary">
    <span className="active-filter-summary-title">Filtri attivi:</span>
    {items.length ? items.map(item => <span className="active-filter-chip" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>) : <span className="active-filter-empty">nessun filtro impostato</span>}
    <Link className="btn btn-md btn-default reset-btn" href="/suppliers"><span className="">↺</span> Reset</Link>
  </div>;
}

export default async function SuppliersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await requireWorkspace('/suppliers');
  const rawFilters = (await searchParams) ?? {};
  const filters = stripFlashRecord(rawFilters);
  const currentYear = new Date().getFullYear();
  const currentQuery = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => item && currentQuery.append(key, item));
    else if (value) currentQuery.set(key, value);
  });
  stripFlashSearchParams(currentQuery);
  const currentQueryString = currentQuery.toString();
  const supplierListHref = `/suppliers${currentQueryString ? `?${currentQueryString}` : ''}`;
  const returnTo = encodeURIComponent(supplierListHref);

  const suppliers = await prisma.supplier.findMany({
    where: { workspaceId: current.workspace.id },
    orderBy: { businessName: 'asc' },
    include: { expenses: { include: { payments: true } } }
  });

  const supplierRows = suppliers.map(supplier => {
    const openExpenses = supplier.expenses.map(expense => {
      const amount = Number(expense.amount.toString());
      const paid = expense.payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
      return Math.max(0, amount - paid);
    }).filter(residual => residual > 0);
    const annualExpenses = supplier.expenses.filter(expense => expense.year === currentYear);
    const annualOrdersCount = annualExpenses.length;
    const annualPurchasedAmount = annualExpenses.reduce((sum, expense) => sum + Number(expense.amount.toString()), 0);
    const amountToPay = openExpenses.reduce((sum, residual) => sum + residual, 0);
    return { supplier, openExpensesCount: openExpenses.length, amountToPay, annualOrdersCount, annualPurchasedAmount };
  });

  const businessNameFilter = normalize(inputDefault(filters, 'businessName'));
  const aliasFilter = normalize(inputDefault(filters, 'alias'));
  const emailFilter = normalize(inputDefault(filters, 'email'));
  const vatNumberFilter = normalize(inputDefault(filters, 'vatNumber'));
  const ibanFilter = normalize(inputDefault(filters, 'iban'));
  const pecFilter = normalize(inputDefault(filters, 'pec'));
  const taxCodeSdiFilter = normalize(inputDefault(filters, 'taxCodeSdi'));

  const filteredSupplierRows = supplierRows.filter(({ supplier }) => {
    if (businessNameFilter && !normalize(supplier.businessName).includes(businessNameFilter)) return false;
    if (aliasFilter && !normalize(supplier.alias).includes(aliasFilter)) return false;
    if (emailFilter && !normalize(supplier.email).includes(emailFilter)) return false;
    if (vatNumberFilter && !normalize(supplier.vatNumber).includes(vatNumberFilter)) return false;
    if (ibanFilter && !normalize(supplier.iban).includes(ibanFilter)) return false;
    if (pecFilter && !normalize(supplier.pec).includes(pecFilter)) return false;
    if (taxCodeSdiFilter && !normalize(supplier.taxCodeSdi).includes(taxCodeSdiFilter)) return false;
    return true;
  });
  const mobileSort = inputDefault(filters, 'mobileSort') || supplierMobileSortOptions[0].value;
  const mobileSortedSupplierRows = [...filteredSupplierRows].sort((a, b) => {
    switch (mobileSort) {
      case 'businessName_desc': return compareText(a.supplier.businessName, b.supplier.businessName, 'desc');
      case 'alias_asc': return compareText(a.supplier.alias, b.supplier.alias, 'asc');
      case 'alias_desc': return compareText(a.supplier.alias, b.supplier.alias, 'desc');
      case 'email_asc': return compareText(a.supplier.email, b.supplier.email, 'asc');
      case 'vatNumber_asc': return compareText(a.supplier.vatNumber, b.supplier.vatNumber, 'asc');
      case 'iban_asc': return compareText(a.supplier.iban, b.supplier.iban, 'asc');
      case 'pec_asc': return compareText(a.supplier.pec, b.supplier.pec, 'asc');
      case 'taxCodeSdi_asc': return compareText(a.supplier.taxCodeSdi, b.supplier.taxCodeSdi, 'asc');
      case 'internalNotes_asc': return compareText(a.supplier.internalNotes, b.supplier.internalNotes, 'asc');
      case 'openExpensesCount_desc': return compareNumber(a.openExpensesCount, b.openExpensesCount, 'desc');
      case 'openExpensesCount_asc': return compareNumber(a.openExpensesCount, b.openExpensesCount, 'asc');
      case 'amountToPay_desc': return compareNumber(a.amountToPay, b.amountToPay, 'desc');
      case 'amountToPay_asc': return compareNumber(a.amountToPay, b.amountToPay, 'asc');
      case 'annualOrdersCount_desc': return compareNumber(a.annualOrdersCount, b.annualOrdersCount, 'desc');
      case 'annualOrdersCount_asc': return compareNumber(a.annualOrdersCount, b.annualOrdersCount, 'asc');
      case 'annualPurchasedAmount_desc': return compareNumber(a.annualPurchasedAmount, b.annualPurchasedAmount, 'desc');
      case 'annualPurchasedAmount_asc': return compareNumber(a.annualPurchasedAmount, b.annualPurchasedAmount, 'asc');
      case 'createdAt_desc': return compareDate(a.supplier.createdAt, b.supplier.createdAt, 'desc');
      case 'updatedAt_desc': return compareDate(a.supplier.updatedAt, b.supplier.updatedAt, 'desc');
      case 'id_desc': return compareNumber(a.supplier.id, b.supplier.id, 'desc');
      case 'id_asc': return compareNumber(a.supplier.id, b.supplier.id, 'asc');
      default: return compareText(a.supplier.businessName, b.supplier.businessName, 'asc');
    }
  });

  const activeFilterItems = [
    inputDefault(filters, 'businessName') && { label: 'Ragione sociale', value: inputDefault(filters, 'businessName') },
    inputDefault(filters, 'alias') && { label: 'Alias', value: inputDefault(filters, 'alias') },
    inputDefault(filters, 'email') && { label: 'Email', value: inputDefault(filters, 'email') },
    inputDefault(filters, 'vatNumber') && { label: 'P.IVA', value: inputDefault(filters, 'vatNumber') },
    inputDefault(filters, 'iban') && { label: 'IBAN', value: inputDefault(filters, 'iban') },
    inputDefault(filters, 'pec') && { label: 'PEC', value: inputDefault(filters, 'pec') },
    inputDefault(filters, 'taxCodeSdi') && { label: 'Codice SDI/C.F.', value: inputDefault(filters, 'taxCodeSdi') }
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const flashMessages = {
    savedMessages: {
      created: 'Fornitore creato.',
      updated: 'Fornitore aggiornato.',
      deleted: 'Fornitore rimosso.',
      bulk_updated: 'Fornitori aggiornati.',
      bulk_deleted: 'Fornitori rimossi.'
    },
    errorMessages: {
      invalid: 'Controlla i dati del fornitore.',
      not_found: 'Fornitore non trovato.',
      in_use: 'Il fornitore è collegato ad altri movimenti.'
    }
  };

  return <div className="grid">
    <div className="toolbar-card toolbar-card-wrap">
      <div>
        <h2>Fornitori</h2>
        <p className="muted">Anagrafica degli esercenti usati nell’inserimento delle spese.</p>
      </div>
      <NewSupplierPanel initialOpen={inputDefault(filters, 'new') === '1'} />
    </div>

    <ActionFeedbackBanner
      searchParams={rawFilters}
      savedMessages={flashMessages.savedMessages}
      errorMessages={flashMessages.errorMessages}
      defaultSavedMessage="Operazione completata."
      defaultErrorMessage="Impossibile completare l’operazione."
    />

    <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('submit', function(event) { const form = event.target; if (form && form.classList && form.classList.contains('confirm-delete-form')) { const message = form.getAttribute('data-confirm') || 'Confermi la rimozione?'; if (!confirm(message)) event.preventDefault(); } });` }} />

    <div className="card expenses-list-card">
      <div className="list-heading recurring-list-heading">
        <div>
          <h2>Lista fornitori</h2>
          <p className="muted">Risultati mostrati: {filteredSupplierRows.length}</p>
        </div>
        <div>
          <SupplierFiltersDrawer filters={filters} />
        </div>
      </div>
      <MobileSortControl action="/suppliers" currentValue={mobileSort} options={supplierMobileSortOptions} searchParams={filters} />

      {activeFilterItems.length ? <div className="recurring-active-filters">
        <div>
          <span className="recurring-active-filters-title">Filtri attivi</span>
          <div className="recurring-active-filter-tags">
            {activeFilterItems.map(item => <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}
          </div>
        </div>
        <Link className="btn btn-xs btn-neutral recurring-active-filters-reset" href="/suppliers">↺ Reset</Link>
      </div> : null}

      <script dangerouslySetInnerHTML={{ __html: `
        (() => {
          const storageKey = 'dmsAccounting.suppliers.filters';
          const resetLink = document.querySelector('a[href="/suppliers"].reset-button');
          const sanitizedSearch = (search) => {
            const params = new URLSearchParams(search || '');
            ['new', 'saved', 'error', 'usage'].forEach(key => params.delete(key));
            Array.from(params.keys()).forEach(key => {
              if (!params.get(key)) params.delete(key);
            });
            const clean = params.toString();
            return clean ? '?' + clean : '';
          };
          if (resetLink) resetLink.addEventListener('click', () => localStorage.removeItem(storageKey));
          const query = sanitizedSearch(window.location.search);
          const form = document.querySelector('form.supplier-filters');
          if (query && query !== '?') localStorage.setItem(storageKey, query);
          else {
            const saved = sanitizedSearch(localStorage.getItem(storageKey) || '');
            if (saved) {
              localStorage.setItem(storageKey, saved);
              window.location.replace('/suppliers' + saved);
            } else {
              localStorage.removeItem(storageKey);
            }
          }
          if (form) form.addEventListener('submit', () => {
            Array.from(form.elements).forEach(field => {
              if (field && field.name && 'value' in field && !field.value) field.disabled = true;
            });
            setTimeout(() => {
              const clean = sanitizedSearch(window.location.search);
              if (clean) localStorage.setItem(storageKey, clean);
              else localStorage.removeItem(storageKey);
            }, 0);
          });
        })();
        document.addEventListener('submit', function(event) { const form = event.target; if (form && form.classList && form.classList.contains('confirm-bulk-form')) { const selected = form.querySelectorAll('input[name="ids"]:checked').length || document.querySelectorAll('input[form="' + form.id + '"][name="ids"]:checked').length; if (!selected) { alert('Seleziona almeno una riga.'); event.preventDefault(); return; } const submitter = event.submitter; const action = submitter && submitter.getAttribute ? submitter.getAttribute('value') : ''; if (!action) { alert('Seleziona un’azione bulk.'); event.preventDefault(); return; } const label = submitter && submitter.textContent ? submitter.textContent.trim() : 'questa azione'; const message = 'Confermi di eseguire "' + label + '" sui fornitori selezionati?'; if (!confirm(message)) event.preventDefault(); } });
        (() => {
          const syncBulkMenus = () => {
            document.querySelectorAll('[data-bulk-menu]').forEach(menu => {
              const formId = menu.getAttribute('data-bulk-form');
              const selected = formId ? document.querySelectorAll('input[form="' + formId + '"][name="ids"]:checked').length : 0;
              menu.classList.toggle('bulk-action-menu-disabled', selected === 0);
              if (selected === 0) menu.removeAttribute('open');
            });
            document.querySelectorAll('[data-bulk-direct-actions]').forEach(group => {
              const formId = group.getAttribute('data-bulk-form');
              const selectedInputs = formId ? Array.from(document.querySelectorAll('input[form="' + formId + '"][name="ids"]:checked')) : [];
              const selected = selectedInputs.length;
              const firstId = selectedInputs[0] ? selectedInputs[0].value : '';
              const returnTo = group.getAttribute('data-return-to') || '';
              const edit = group.querySelector('[data-bulk-edit]');
              const copy = group.querySelector('[data-bulk-copy]');
              const del = group.querySelector('[data-bulk-delete]');
              const singleEnabled = selected === 1;
              const anyEnabled = selected > 0;
              if (edit) {
                edit.classList.toggle('is-disabled', !singleEnabled);
                edit.setAttribute('aria-disabled', singleEnabled ? 'false' : 'true');
                edit.href = singleEnabled ? (group.getAttribute('data-edit-base') + firstId + '/edit?returnTo=' + returnTo) : '#';
              }
              if (copy) {
                copy.classList.toggle('is-disabled', !singleEnabled);
                copy.setAttribute('aria-disabled', singleEnabled ? 'false' : 'true');
                copy.href = singleEnabled ? (group.getAttribute('data-copy-base') + firstId + '&returnTo=' + returnTo) : '#';
              }
              if (del) del.disabled = !anyEnabled;
            });
          };
          document.addEventListener('change', function(event) {
            const target = event.target;
            if (target && target.classList && target.classList.contains('bulk-select-all')) {
              const formId = target.getAttribute('data-bulk-target');
              if (!formId) return;
              document.querySelectorAll('input[form="' + formId + '"][name="ids"]').forEach(input => { input.checked = target.checked; });
            }
            if (target && target.matches && (target.matches('input[name="ids"]') || target.classList.contains('bulk-select-all'))) syncBulkMenus();
          });
          document.addEventListener('click', function(event) {
            document.querySelectorAll('[data-bulk-menu][open]').forEach(menu => {
              if (!menu.contains(event.target)) menu.removeAttribute('open');
            });
          });
          document.addEventListener('click', function(event) {
            const link = event.target.closest && event.target.closest('.bulk-direct-link.is-disabled');
            if (link) event.preventDefault();
          });
          document.addEventListener('toggle', function(event) {
            const menu = event.target;
            if (menu && menu.matches && menu.matches('[data-bulk-menu][open]')) {
              const formId = menu.getAttribute('data-bulk-form');
              const selected = formId ? document.querySelectorAll('input[form="' + formId + '"][name="ids"]:checked').length : 0;
              if (!selected) menu.removeAttribute('open');
            }
          }, true);
          syncBulkMenus();
        })();
      ` }} />

      <BulkSelectionController />

      <form id="supplierBulkForm" action={`/api/suppliers/bulk?returnTo=${returnTo}`} method="post" className="bulk-actions-bar confirm-bulk-form">
        <details className="bulk-action-menu bulk-action-menu-disabled" data-bulk-menu data-bulk-form="supplierBulkForm">
          <summary className="bulk-action-trigger">
            <span className="btn-icon">⚙</span>
            <span className="bulk-label">
              <span className="floating-bulk-label">Bulk </span>Actions
            </span>
          </summary>
          <div className="bulk-action-menu-panel">
            <button className="btn btn-sm btn-danger" type="submit" name="bulkAction" value="delete"><span className="btn-icon">🗑</span><span className="bulk-label">Elimina selezionati</span></button>
          </div>
        </details>
        <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="supplierBulkForm" data-edit-base="/suppliers/" data-copy-base="/suppliers/new?copyId=" data-return-to={returnTo}>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="bulk-label">Modifica</span></a>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true"><span className="btn-icon">⧉</span><span className="bulk-label">Copia</span></a>
          <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled><span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span></button>
        </div>
        <div className="bulk-inner-container">
          <button className="bulk-direct-link btn btn-md btn-primary" type="button" data-bulk-new data-supplier-new data-floating-label="Fornitore">
            <span className="btn-icon">+</span>
            <span className="bulk-label">Fornitore</span>
          </button>
        </div>
      </form>
      <SortableTableController />

      <div className="supplier-mobile-list expense-mobile-list" aria-label="Lista fornitori mobile">
        {mobileSortedSupplierRows.map(({ supplier, openExpensesCount, amountToPay, annualOrdersCount, annualPurchasedAmount }) => {
          const detailHref = `/suppliers/${supplier.id}?returnTo=${encodeURIComponent(supplierListHref)}`;
          return <div className={amountToPay > 0 ? "supplier-mobile-item expense-mobile-item expense-mobile-item-overdue" : "supplier-mobile-item expense-mobile-item"} key={`mobile-supplier-${supplier.id}`}>
            <div className="expense-mobile-select">
              <input form="supplierBulkForm" type="checkbox" name="ids" value={supplier.id} aria-label={`Seleziona fornitore ${supplier.businessName}`} />
            </div>
            <Link className="expense-mobile-link supplier-mobile-link" href={detailHref}>
              <div className="expense-mobile-main">
                <div className="expense-mobile-title-row">
                  <div className="expense-mobile-title-left">
                    <strong>{supplier.businessName}</strong>
                  </div>
                  <div className="expense-mobile-title-right">
                    <span className={amountToPay > 0 ? 'text-warning' : 'text-ok'}>{euro(amountToPay)}</span>
                  </div>
                </div>
                <div className="expense-mobile-subtitle">
                  <span className="supplier-mobile-row-grow">{supplier.alias || 'Nessun alias'}</span>
                  <span className="supplier-mobile-row-grow text-rright"><strong>{openExpensesCount}</strong> ordini da saldare</span>
                </div>
                <div className="expense-mobile-meta">
                  <span className="supplier-mobile-row"><strong className="badge color-badge tone-insurance">{euro(annualPurchasedAmount)}</strong> acquistati {currentYear}</span>
                  <div className="supplier-mobile-row-right">
                    <span className="badge badge-color">{annualOrdersCount} ordini {currentYear}</span>
                  </div>
                  {/*<span>{euro(annualPurchasedAmount)} acquistati {currentYear}</span>*/}
                  {/*{supplier.email ? <span>{supplier.email}</span> : null}*/}
                  {/*{supplier.pec ? <span>PEC</span> : null}*/}
                </div>
              </div>
            </Link>
          </div>;
        })}
        {!filteredSupplierRows.length && <div className="expense-empty-panel">Nessun fornitore trovato.</div>}
      </div>

      <div className="table-scroll"><table className="suppliers-table compact-suppliers-table" data-sortable-table data-default-sort="business-name" data-default-sort-dir="asc"><thead><tr>
        <th className="cell-center">
          <input type="checkbox" className="bulk-select-all" data-bulk-target="supplierBulkForm" aria-label="Seleziona tutti i fornitori" />
        </th>
        <th data-sort-key="business-name">Ragione <br />Sociale</th>
        <th data-sort-key="alias">Alias</th>
        <th className="text-center" data-sort-key="open-count" data-sort-type="number">Ordini <br />da saldare</th>
        <th className="text-right supplier-amount-header" data-sort-key="open-amount" data-sort-type="number">Importo <br />da saldare</th>
        <th className="text-center" data-sort-key="annual-count" data-sort-type="number">Ordini <br />anno</th>
        <th className="text-right" data-sort-key="annual-amount" data-sort-type="number">Acquisti <br />anno</th>
      </tr></thead><tbody>
        {filteredSupplierRows.map(({ supplier, openExpensesCount, amountToPay, annualOrdersCount, annualPurchasedAmount }) => {
          return <tr
            className="clickable-desktop-row"
            data-row-href={`/suppliers/${supplier.id}?returnTo=${encodeURIComponent(supplierListHref)}`}
            data-sort-row
            data-sort-business-name={supplier.businessName}
            data-sort-alias={supplier.alias ?? ''}
            data-sort-open-count={String(openExpensesCount)}
            data-sort-open-amount={String(amountToPay)}
            data-sort-annual-count={String(annualOrdersCount)}
            data-sort-annual-amount={String(annualPurchasedAmount)}
            tabIndex={0}
            key={supplier.id}
          >
            <td className="cell-center"><input form="supplierBulkForm" className="bulk-select-all" type="checkbox" name="ids" value={supplier.id} aria-label={`Seleziona fornitore ${supplier.businessName}`} /></td>
            <td><strong>{supplier.businessName}</strong></td>
            <td>{supplier.alias ?? '-'}</td>
            <td className="text-center"><strong className={openExpensesCount > 0 ? 'text-warning' : ''}>{openExpensesCount}</strong></td>
            <td className="text-right supplier-amount-cell"><strong className={amountToPay > 0 ? 'text-warning' : 'text-ok'}>{euro(amountToPay)}</strong></td>
            <td className="text-center"><strong>{annualOrdersCount}</strong></td>
            <td className="text-right supplier-amount-cell"><strong className="badge color-badge tone-insurance">{euro(annualPurchasedAmount)}</strong></td>
          </tr>;
        })}
        {!filteredSupplierRows.length && <tr><td colSpan={7}>Nessun fornitore trovato.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}
