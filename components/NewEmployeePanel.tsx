'use client';

import {useEffect, useState} from 'react';
import EmployeeCreateModal from '@/components/EmployeeCreateModal';
import {flashParamNames} from '@/lib/flash';

export default function NewEmployeePanel({initialOpen = false}: {initialOpen?: boolean}) {
  const [open, setOpen] = useState(initialOpen);
  const [action, setAction] = useState('/api/employees');
  useEffect(() => {
    const url = new URL(window.location.href); url.searchParams.delete('new'); flashParamNames.forEach(key => url.searchParams.delete(key));
    setAction(`/api/employees?returnTo=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }, []);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest('[data-employee-new]')) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);
  return <><button className="btn btn-sm btn-primary btn-stretch" type="button" data-employee-new><span className="btn-icon">＋</span>Nuovo dipendente</button><EmployeeCreateModal open={open} onClose={() => setOpen(false)} action={action}/></>;
}
