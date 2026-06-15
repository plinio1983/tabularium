import Link from 'next/link';
import BulkSelectionController from '@/components/BulkSelectionController';
import { prisma } from '@/lib/prisma';
import { euro } from '@/lib/money';
import NewSupplierPanel from '@/components/NewSupplierPanel';
import SupplierFiltersDrawer from '@/components/SupplierFiltersDrawer';

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
    <Link className="button-standard secondary-action reset-btn" href="/suppliers"><span className="">↺</span> Reset</Link>
  </div>;
}

export default async function SuppliersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = (await searchParams) ?? {};
  const currentYear = new Date().getFullYear();
  const currentQuery = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => item && currentQuery.append(key, item));
    else if (value) currentQuery.set(key, value);
  });
  const currentQueryString = currentQuery.toString();
  const supplierListHref = `/suppliers${currentQueryString ? `?${currentQueryString}` : ''}`;
  const returnTo = encodeURIComponent(supplierListHref);

  const suppliers = await prisma.supplier.findMany({
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
  const phoneFilter = normalize(inputDefault(filters, 'phone'));
  const pecFilter = normalize(inputDefault(filters, 'pec'));
  const taxCodeSdiFilter = normalize(inputDefault(filters, 'taxCodeSdi'));

  const filteredSupplierRows = supplierRows.filter(({ supplier }) => {
    if (businessNameFilter && !normalize(supplier.businessName).includes(businessNameFilter)) return false;
    if (aliasFilter && !normalize(supplier.alias).includes(aliasFilter)) return false;
    if (emailFilter && !normalize(supplier.email).includes(emailFilter)) return false;
    if (phoneFilter && !normalize(supplier.phone).includes(phoneFilter)) return false;
    if (pecFilter && !normalize(supplier.pec).includes(pecFilter)) return false;
    if (taxCodeSdiFilter && !normalize(supplier.taxCodeSdi).includes(taxCodeSdiFilter)) return false;
    return true;
  });

  const activeFilterItems = [
    inputDefault(filters, 'businessName') && { label: 'Ragione sociale', value: inputDefault(filters, 'businessName') },
    inputDefault(filters, 'alias') && { label: 'Alias', value: inputDefault(filters, 'alias') },
    inputDefault(filters, 'email') && { label: 'Email', value: inputDefault(filters, 'email') },
    inputDefault(filters, 'phone') && { label: 'Telefono', value: inputDefault(filters, 'phone') },
    inputDefault(filters, 'pec') && { label: 'PEC', value: inputDefault(filters, 'pec') },
    inputDefault(filters, 'taxCodeSdi') && { label: 'Codice SDI/C.F.', value: inputDefault(filters, 'taxCodeSdi') }
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return <div className="grid">
    <div className="toolbar-card toolbar-card-wrap">
      <div>
        <h2>Fornitori</h2>
        <p className="muted">Anagrafica degli esercenti usati nell’inserimento delle spese.</p>
      </div>
      <NewSupplierPanel initialOpen={inputDefault(filters, 'new') === '1'} />
    </div>

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

      {activeFilterItems.length ? <div className="recurring-active-filters">
        <div>
          <span className="recurring-active-filters-title">Filtri attivi</span>
          <div className="recurring-active-filter-tags">
            {activeFilterItems.map(item => <span className="badge" key={`${item.label}-${item.value}`}><strong>{item.label}:</strong> {item.value}</span>)}
          </div>
        </div>
        <Link className="table-action secondary recurring-active-filters-reset reset-button" href="/suppliers">↺ Reset</Link>
      </div> : null}

      <script dangerouslySetInnerHTML={{ __html: `
        (() => {
          const storageKey = 'dmsAccounting.suppliers.filters';
          const resetLink = document.querySelector('a[href="/suppliers"].reset-button');
          const sanitizedSearch = (search) => {
            const params = new URLSearchParams(search || '');
            params.delete('new');
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
          <summary className="bulk-action-trigger"><span className="btn-icon">⚙</span><span className="bulk-label">Bulk actions</span></summary>
          <div className="bulk-action-menu-panel">
            <button type="submit" name="bulkAction" value="delete"><span className="btn-icon">🗑</span><span className="bulk-label">Elimina selezionati</span></button>
          </div>
        </details>
        <div className="bulk-direct-actions" data-bulk-direct-actions data-bulk-form="supplierBulkForm" data-edit-base="/suppliers/" data-copy-base="/suppliers/new?copyId=" data-return-to={returnTo}>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-edit aria-disabled="true"><span className="btn-icon">✎</span><span className="bulk-label">Modifica</span></a>
          <a href="#" className="bulk-direct-link is-disabled" data-bulk-copy aria-disabled="true"><span className="btn-icon">＋</span><span className="bulk-label">Copia</span></a>
          <button type="submit" className="bulk-direct-link bulk-direct-danger" name="bulkAction" value="delete" data-bulk-delete data-confirm-label="Elimina" disabled><span className="btn-icon">🗑</span><span className="bulk-label">Elimina</span></button>
        </div>
        <div className="bulk-inner-container">
          <button className="bulk-direct-link button-standard primary-action" type="button" data-bulk-new data-supplier-new data-floating-label="Fornitore">
            <span className="btn-icon">+</span>
            <span className="bulk-label">Fornitore</span>
          </button>
        </div>
      </form>

      <div className="supplier-mobile-list expense-mobile-list" aria-label="Lista fornitori mobile">
        {filteredSupplierRows.map(({ supplier, openExpensesCount, amountToPay, annualOrdersCount, annualPurchasedAmount }) => {
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
                  <span className="supplier-mobile-row"><strong className="badge color-badge tone-insurance">{euro(annualPurchasedAmount)}</strong> acquistati {currentYear}</span>
                </div>
                <div className="expense-mobile-meta">
                  <span className="supplier-mobile-row-grow">{openExpensesCount} ordini da saldare</span>
                  <span className="badge badge-color">{annualOrdersCount} ordini {currentYear}</span>
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

      <div className="table-scroll"><table className="suppliers-table compact-suppliers-table"><thead><tr>
        <th className="cell-center">
          <input type="checkbox" className="bulk-select-all" data-bulk-target="supplierBulkForm" aria-label="Seleziona tutti i fornitori" />
        </th>
        <th>Ragione <br />Sociale</th>
        <th>Alias</th>
        <th className="text-center">Ordini <br />da saldare</th>
        <th className="text-right supplier-amount-header">Importo <br />da saldare</th>
        <th className="text-center">Ordini <br />anno</th>
        <th className="text-right">Acquisti <br />anno</th>
      </tr></thead><tbody>
        {filteredSupplierRows.map(({ supplier, openExpensesCount, amountToPay, annualOrdersCount, annualPurchasedAmount }) => {
          return <tr className="clickable-desktop-row" data-row-href={`/suppliers/${supplier.id}?returnTo=${encodeURIComponent(supplierListHref)}`} tabIndex={0} key={supplier.id}>
            <td className="cell-center"><input form="supplierBulkForm" className="bulk-select-all" type="checkbox" name="ids" value={supplier.id} aria-label={`Seleziona fornitore ${supplier.businessName}`} /></td>
            <td><strong>{supplier.businessName}</strong></td>
            <td>{supplier.alias ?? '-'}</td>
            <td className="text-center"><strong>{openExpensesCount}</strong></td>
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
