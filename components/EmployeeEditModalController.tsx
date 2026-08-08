'use client';

import {useEffect, useState} from 'react';
import EmployeeFormFields, {type EmployeeFormValues} from '@/components/EmployeeFormFields';
import EntityFormActions from '@/components/EntityFormActions';

type EmployeeData = EmployeeFormValues & {id: number; firstName: string; lastName: string};

export default function EmployeeEditModalController() {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [returnTo, setReturnTo] = useState('/employees');
  useEffect(() => {
    const click = async (event: MouseEvent) => {
      const trigger = (event.target as Element | null)?.closest<HTMLElement>('[data-employee-edit-id]');
      const id = trigger?.dataset.employeeEditId; if (!id) return;
      event.preventDefault();
      const response = await fetch(`/api/employees/${id}/edit-data`, {cache: 'no-store'});
      if (!response.ok) return window.alert('Impossibile caricare il dipendente.');
      const url = new URL(window.location.href); ['saved', 'error'].forEach(key => url.searchParams.delete(key)); setReturnTo(`${url.pathname}${url.search}`); setEmployee(await response.json());
    };
    document.addEventListener('click', click); return () => document.removeEventListener('click', click);
  }, []);
  if (!employee) return null;
  return <div className="modal-backdrop app-form-modal" role="dialog" aria-modal="true" aria-label={`Modifica ${employee.firstName} ${employee.lastName}`} onMouseDown={() => setEmployee(null)}>
    <div className="modal-card modal-card-wide entity-form-modal-card" onMouseDown={event => event.stopPropagation()}>
      <div className="modal-title"><div><h3>Modifica dipendente</h3><p className="muted">Aggiorna l’anagrafica di {employee.firstName} {employee.lastName}.</p></div><button className="btn btn-icon-only btn-default modal-close-button" type="button" onClick={() => setEmployee(null)}>×</button></div>
      <form className="card form app-record-form entity-form entity-styled-form inline-create-form" action={`/api/employees/${employee.id}?returnTo=${encodeURIComponent(returnTo)}`} method="post"><EmployeeFormFields employee={employee}/><EntityFormActions onCancel={() => setEmployee(null)} submitLabel="Salva modifiche"/></form>
    </div>
  </div>;
}
