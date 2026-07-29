"use client";

import { useEffect, useState } from "react";

const importTypes = {
  single_expenses: {
    label: "Lista spese singole",
    fileName: "import-spese-template.xlsx",
    href: "/templates/import-spese-template.xlsx",
    note: "Importa lo storico delle spese. Le righe ricorrenti vengono marcate solo con il flag Ricorrente sì/no."
  },
  recurring_definitions: {
    label: "Definizioni uscite ricorrenti",
    fileName: "import-spese-ricorrenti-template.xlsx",
    href: "/templates/import-spese-ricorrenti-template.xlsx",
    note: "Importa solo le definizioni ricorrenti. Non genera nessuna spesa: le spese saranno create dal processo api/cron/recurring-expenses."
  },
  incomes: {
    label: "Incassi",
    fileName: "import-incassi-template.xlsx",
    href: "/templates/import-incassi-template.xlsx",
    note: "Importa gli incassi, crea i clienti mancanti e ignora le righe già presenti."
  },
  customers: {
    label: "Clienti",
    fileName: "import-clienti-template.xlsx",
    href: "/templates/import-clienti-template.xlsx",
    note: "Crea nuovi clienti e aggiorna in modo non distruttivo quelli già presenti."
  },
  suppliers: {
    label: "Fornitori",
    fileName: "import-fornitori-template.xlsx",
    href: "/templates/import-fornitori-template.xlsx",
    note: "Crea nuovi fornitori e aggiorna in modo non distruttivo quelli già presenti."
  }
};

type ImportType = keyof typeof importTypes;

function validImportType(value?: string): value is ImportType {
  return Boolean(value && value in importTypes);
}

export default function ExpenseImportTypeSelector({initialType}: {initialType?: string}) {
  const [importType, setImportType] = useState<ImportType>(validImportType(initialType) ? initialType : "single_expenses");
  const current = importTypes[importType];

  useEffect(() => {
    const clearInput = document.querySelector<HTMLInputElement>('#expenseImportForm input[name="clearBeforeImport"]');
    if (!clearInput) return;
    const disabled = importType === 'customers' || importType === 'suppliers';
    clearInput.disabled = disabled;
    if (disabled) clearInput.checked = false;
  }, [importType]);

  return <div className="import-type-selector">
    <label>
      Tipo importazione
      <select form="expenseImportForm" name="importType" value={importType} onChange={(event) => setImportType(event.currentTarget.value as ImportType)}>
        <option value="single_expenses">Lista spese singole</option>
        <option value="recurring_definitions">Definizioni uscite ricorrenti</option>
        <option value="incomes">Incassi</option>
        <option value="customers">Clienti</option>
        <option value="suppliers">Fornitori</option>
      </select>
    </label>
    {/*<a className="btn btn-md btn-primary" href={current.href} download>*/}
    {/*  <span className="btn-icon">⬇</span>Scarica modello XLSX*/}
    {/*</a>*/}
    <a className="import-template-download" href={current.href} download>
      <span className="import-template-icon">⬇</span>
      <span>
        <strong>Scarica file di esempio</strong>
        <small>{current.fileName}</small>
      </span>
    </a>
    <p className="muted import-template-note">{current.note}</p>
  </div>;
}
