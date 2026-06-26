'use client';

import { useEffect } from 'react';

const filterStorageKeys = [
  'dmsAccounting.expenses.filters',
  'dmsAccounting.incomes.filters'
];

export default function ClearPersistedFilters() {
  useEffect(() => {
    filterStorageKeys.forEach(key => window.localStorage.removeItem(key));
  }, []);

  return null;
}
