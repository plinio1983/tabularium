'use client';

import { useEffect, useRef } from 'react';
import {useSearchParams} from 'next/navigation';
import {compareListDates, hasMultipleMonths, listMonthKey, listMonthLabel} from '@/lib/list-month-groups';

function sortableRows(table: HTMLTableElement) {
  const body = table.tBodies.item(0);
  return body ? Array.from(body.querySelectorAll<HTMLTableRowElement>('tr[data-sort-row]')) : [];
}

function sortValue(row: HTMLTableRowElement, key: string) {
  return row.getAttribute(`data-sort-${key}`) ?? '';
}

function compareValues(a: string, b: string, type: string) {
  if (type === 'number' || type === 'date') {
    const aNumber = Number(a);
    const bNumber = Number(b);
    const aEmpty = !Number.isFinite(aNumber);
    const bEmpty = !Number.isFinite(bNumber);
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    return aNumber - bNumber;
  }

  return a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' });
}

function applySort(table: HTMLTableElement, key: string, direction: 'asc' | 'desc') {
  const header = table.querySelector<HTMLElement>(`[data-sort-key="${key}"]`);
  const type = header?.getAttribute('data-sort-type') ?? 'text';
  const body = table.tBodies.item(0);
  if (!body) return;

  const rows = sortableRows(table);
  const temporal = type === 'date' || key === 'billing-period';
  const dateValue = (row: HTMLTableRowElement) => {
    const value = sortValue(row, key);
    return value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
  };
  rows.sort((a, b) => {
    if (temporal) return compareListDates(dateValue(a), dateValue(b), direction);
    const compared = compareValues(sortValue(a, key), sortValue(b, key), type);
    return direction === 'asc' ? compared : -compared;
  });
  rows.forEach(row => body.appendChild(row));
  body.querySelectorAll('[data-month-heading]').forEach(row => row.remove());
  if (temporal && table.dataset.monthGrouping === 'true') {
    const keys = rows.map(row => listMonthKey(dateValue(row), key === 'billing-period' ? 'billing' : 'date', table.dataset.monthTimeZone ?? 'UTC'));
    if (hasMultipleMonths(keys)) rows.forEach((row, index) => {
      if (index > 0 && keys[index] === keys[index - 1]) return;
      const separator = document.createElement('tr');
      separator.dataset.monthHeading = 'true';
      separator.className = 'list-month-row';
      const cell = document.createElement('td');
      cell.colSpan = row.cells.length;
      const title = document.createElement('h2');
      title.className = 'list-month-heading';
      title.textContent = listMonthLabel(keys[index]);
      cell.appendChild(title);
      separator.appendChild(cell);
      body.insertBefore(separator, row);
    });
  }

  table.querySelectorAll<HTMLElement>('[data-sort-key]').forEach(item => {
    item.classList.remove('sort-asc', 'sort-desc');
    item.setAttribute('aria-sort', 'none');
  });
  header?.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
  header?.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
  table.dataset.currentSort = key;
  table.dataset.currentSortDir = direction;
}

function nextDirection(table: HTMLTableElement, key: string) {
  if (table.dataset.currentSort !== key) return 'asc';
  return table.dataset.currentSortDir === 'asc' ? 'desc' : 'asc';
}

function activateHeader(header: HTMLElement) {
  const table = header.closest<HTMLTableElement>('table[data-sortable-table]');
  const key = header.getAttribute('data-sort-key');
  if (!table || !key) return;
  applySort(table, key, nextDirection(table, key));
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('a, button, input, select, textarea, label, summary'));
}

export default function SortableTableController() {
  const query = useSearchParams().toString();
  const sorts = useRef<Array<{key: string; direction: 'asc' | 'desc'}>>([]);
  useEffect(() => {
    document.querySelectorAll<HTMLTableElement>('table[data-sortable-table]').forEach((table, index) => {
      table.querySelectorAll<HTMLElement>('[data-sort-key]').forEach(header => {
        header.classList.add('sortable-th');
        header.tabIndex = 0;
        header.setAttribute('role', 'button');
        header.setAttribute('aria-sort', 'none');
      });

      const defaultSort = sorts.current[index]?.key ?? table.dataset.currentSort ?? table.dataset.defaultSort;
      const defaultDirection = sorts.current[index]?.direction ?? (table.dataset.currentSortDir === 'asc' || (!table.dataset.currentSortDir && table.dataset.defaultSortDir === 'asc') ? 'asc' : 'desc');
      if (defaultSort) applySort(table, defaultSort, defaultDirection);
    });

    const onClick = (event: MouseEvent) => {
      if (isInteractiveTarget(event.target)) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-sort-key]') : null;
      if (!target) return;
      activateHeader(target);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof HTMLElement && event.target.matches('[data-sort-key]') ? event.target : null;
      if (!target) return;
      event.preventDefault();
      activateHeader(target);
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.querySelectorAll<HTMLTableElement>('table[data-sortable-table]').forEach((table, index) => {
        if (table.dataset.currentSort) sorts.current[index] = {key: table.dataset.currentSort, direction: table.dataset.currentSortDir === 'asc' ? 'asc' : 'desc'};
        table.querySelectorAll('[data-month-heading]').forEach(row => row.remove());
      });
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [query]);

  return null;
}
