import { Suspense } from 'react';
import Link from 'next/link';
import ExpenseImportTypeSelector from '@/components/ExpenseImportTypeSelector';

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function ImportExpensesContent({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const imported = param(params, 'imported');
  const skipped = param(params, 'skipped');
  const deleted = param(params, 'deleted');
  const updated = param(params, 'updated');
  const duplicates = param(params, 'duplicates');
  const related = param(params, 'related');
  const importType = param(params, 'type') ?? 'single_expenses';
  const sheets = param(params, 'sheets');
  const error = param(params, 'error');
  const detail = param(params, 'detail');
  const hasResult = imported !== undefined || skipped !== undefined || deleted !== undefined || updated !== undefined || sheets !== undefined;
  const entityLabels: Record<string, { singular: string; plural: string; listHref: string }> = {
    single_expenses: { singular: 'spesa', plural: 'Spese', listHref: '/expenses' },
    recurring_definitions: { singular: 'definizione ricorrente', plural: 'Definizioni ricorrenti', listHref: '/recurring-expenses' },
    incomes: { singular: 'incasso', plural: 'Incassi', listHref: '/incomes' },
    customers: { singular: 'cliente', plural: 'Clienti', listHref: '/clients' },
    suppliers: { singular: 'fornitore', plural: 'Fornitori', listHref: '/suppliers' }
  };
  const entity = entityLabels[importType] ?? entityLabels.single_expenses;

  return <div className="grid import-page">
    <div className="toolbar-card import-hero-card">
      <div className="import-hero-title">
        {/*<span className="badge">Importazione dati</span>*/}
        <Link className="btn btn-xs btn-default" href="/"><span className="btn-icon">↩</span> Torna alla dashboard</Link>
        <h2>Importa dati da Excel / ODS</h2>
        <p className="muted">Importa dati, definizioni ricorrenti, incassi, clienti o fornitori usando il relativo modello compilabile.</p>
      </div>
      <div className="import-hero-actions">
        <ExpenseImportTypeSelector initialType={importType} />
      </div>
    </div>

    {error ? <div className="card import-status-card error-card">
      <strong>Importazione non completata.</strong>
      <p className="muted">
        {error === 'invalid_file_type'
          ? <div className="inline-modal-error">Formato non valido. Usa un file XLSX, XLS o ODS.</div>
          : error === 'file_too_large'
            ? <div className="inline-modal-error">Il file supera il limite di 20 MB.</div>
        : error === 'empty_file'
          ? 'Il file è stato letto, ma non sono state trovate righe compatibili con il modello di importazione selezionato.'
          : error === 'no_rows_imported'
            ? 'Il file è stato letto, ma nessuna riga è stata importata. Controlla dati obbligatori, importi, date e tipo importazione.'
            : 'Controlla che il file sia valido e che contenga le colonne obbligatorie per il tipo selezionato.'}
      </p>
      {skipped ? <p className="muted">Righe saltate: {skipped}</p> : null}
      {sheets ? <p className="muted">Fogli letti: {sheets}</p> : null}
      {detail ? <p className="muted import-result-detail">Prime righe non importate: {detail}</p> : null}
      {detail ? <p className="muted">Dettaglio tecnico: {detail}</p> : null}
    </div> : null}

    {!error && hasResult ? <div className="card import-status-card success-card">
      <div className="import-status-heading">
        <div>
          <span className="badge">Completata</span>
          <h3>Importazione completata</h3>
        </div>
        <Link className="btn btn-md btn-primary" href={entity.listHref}><span className="btn-icon">↗</span>Vai a {entity.plural.toLocaleLowerCase('it-IT')}</Link>
      </div>
      <div className="import-result-grid">
        <div><span>{entity.plural} creati</span><strong>{imported}</strong></div>
        <div><span>Record aggiornati</span><strong>{updated ?? 0}</strong></div>
        <div><span>Duplicati ignorati</span><strong>{duplicates ?? 0}</strong></div>
        <div><span>Righe non valide</span><strong>{skipped ?? 0}</strong></div>
        <div><span>Record eliminati prima dell’import</span><strong>{deleted ?? 0}</strong></div>
        <div><span>Entità collegate create</span><strong>{related ?? 0}</strong></div>
      </div>
      {sheets ? <p className="muted">Fogli letti: {sheets}</p> : null}
    </div> : null}

    <div className="import-layout-grid">
      <form id="expenseImportForm" action="/api/expenses/import" method="post" encType="multipart/form-data" className="card import-form-card">
        <div className="import-card-heading">
          <div>
            <h3>Nuova importazione</h3>
            <p className="muted">Sono accettati file .xlsx, .xls e .ods. Il tipo si seleziona nel riquadro superiore.</p>
          </div>
          {/*<span className="badge">Step 1</span>*/}
        </div>

        <label className="import-file-drop">
          <span className="import-file-icon">📄</span>
          <strong>Seleziona il file da importare</strong>
          <small className="muted">Usa il modello XLSX corretto per il tipo di importazione selezionato.</small>
          <input type="file" name="file" accept=".xlsx,.xls,.ods" required />
        </label>

        <label className="import-clear-option">
          <input type="checkbox" name="clearBeforeImport" />
          <span>
            <strong>Elimina i record esistenti prima di importare</strong>
            <small className="muted">Si applica a spese, definizioni ricorrenti e incassi. Clienti e fornitori vengono sempre aggiornati senza eliminazioni.</small>
          </span>
        </label>

        <div className="actions-row right-actions">
          <Link className="btn btn-xs btn-default" href="/"><span className="btn-icon">✕</span> Annulla</Link>
          <button type="submit" className="btn btn-md btn-primary"><span className="btn-icon">⬆</span>Avvia importazione</button>
        </div>
      </form>

      <div className="card import-template-card">
        <div className="import-card-heading">
          <div>
            <h3>Modello compilabile</h3>
            <p className="muted">Scarica il file di esempio, compila le righe e ricaricalo da questa pagina.</p>
          </div>
          <span className="badge">XLSX</span>
        </div>
        <p className="muted import-template-note">La selezione del tipo importazione aggiorna automaticamente il modello XLSX da scaricare.</p>
      </div>
    </div>

    <div className="card import-rules-card">
      <h3>Regole applicate</h3>
      <ul className="muted import-rules-list">
        <li>Se è valorizzata solo una tra <strong>Data ordine</strong> e <strong>Data scadenza</strong>, quella data viene usata per entrambi i campi.</li>
        <li><strong>Stato fattura = Ok</strong>, <strong>Emessa</strong> o <strong>Ricevuta</strong> viene importato come <strong>RICEVUTA</strong>.</li>
        <li>Le banche non presenti nella configurazione vengono importate come <strong>Cassa</strong>.</li>
        <li>I fornitori non ancora presenti vengono creati automaticamente; eventuali <strong>Note fornitore</strong> presenti nel file vengono salvate come note interne.</li>
        <li>Con <strong>Definizioni uscite ricorrenti</strong> vengono create solo le regole ricorrenti: nessun record spesa viene generato dall’importazione.</li>
        <li>Clienti e fornitori esistenti vengono riconosciuti tramite <strong>Partita IVA</strong> o <strong>ragione sociale</strong>; le celle vuote non cancellano i dati presenti.</li>
        <li>Gli incassi duplicati vengono riconosciuti confrontando cliente, importo, data, periodo, canale e descrizione.</li>
        <li>Durante l’importazione degli incassi, clienti e canali mancanti vengono creati automaticamente.</li>
      </ul>
    </div>
  </div>;
}


export default function ImportExpensesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<div className="card"><p className="muted">Caricamento importazione...</p></div>}>
      <ImportExpensesContent searchParams={searchParams} />
    </Suspense>
  );
}
