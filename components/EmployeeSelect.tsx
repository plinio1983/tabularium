type EmployeeOption = {id: number; firstName: string; lastName: string; employeeCode?: string | null; status?: 'ACTIVE' | 'INACTIVE'};

export default function EmployeeSelect({employees, name = 'employeeId', id = 'employeeId', defaultValue, required = false}: {employees: EmployeeOption[]; name?: string; id?: string; defaultValue?: number | null; required?: boolean}) {
  const visible = employees.filter(employee => employee.status !== 'INACTIVE' || employee.id === defaultValue);
  return <div className="app-select-control"><select id={id} name={name} defaultValue={defaultValue ?? ''} required={required}><option value="">Seleziona dipendente</option>{visible.map(employee => <option key={employee.id} value={employee.id}>{employee.lastName} {employee.firstName}{employee.employeeCode ? ` · ${employee.employeeCode}` : ''}{employee.status === 'INACTIVE' ? ' · inattivo' : ''}</option>)}</select><span className="app-select-caret" aria-hidden="true">⌄</span></div>;
}
