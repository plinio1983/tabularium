# Tabularium

Gestionale web interno per sostituire il file Excel di incassi e spese.

## Stack

- Next.js + TypeScript
- PostgreSQL
- Prisma 7
- Prisma PostgreSQL adapter
- Import Excel con `xlsx`

## Avvio locale

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:sync
npm run db:seed
npm run dev
```

Apri:

```bash
http://localhost:3000
```

## Funzioni principali

- Dashboard e viste mensili.
- Gestione spese con pagamenti multipli e allegati multipli fino a 5 file.
- Lista spese con filtri persistenti, selezione rapida periodo e totali calcolati sui risultati mostrati.
- Copia spesa: dalla lista o dal dettaglio si apre un nuovo form precompilato senza pagamenti e con stato pagamento non pagato.
- Anagrafica Fornitori con lista, creazione, modifica ed eliminazione.
- Autocomplete fornitore nel form spesa, con ricerca per Ragione Sociale o Referente, navigabile anche da tastiera.
- Creazione rapida fornitore in modale dal form spesa.

## Prisma 7

La connessione al database è configurata in `prisma.config.ts`, non nel file `schema.prisma`.
Non configurare manualmente `DATABASE_URL`: l'app e Prisma la costruiscono dalle variabili `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_SCHEMA`, sia in locale sia in produzione.

Comando rapido consigliato dopo ogni aggiornamento della struttura:

```bash
npm run db:sync
npm run db:seed
```

Se il database locale contiene dati sperimentali e vuoi ripartire pulito:

```bash
npm run db:reset-local
npm run db:sync
npm run db:seed
npm run dev
```

## Import Excel

Copia il file in `data/Spese-Ricavi.xlsx` e lancia:

```bash
npm run import:excel -- data/Spese-Ricavi.xlsx
```


## Incassi v13

Questa versione aggiunge la sezione `/incomes` per inserimento, modifica, dettaglio, rimozione, filtri persistenti e totali degli incassi. La selezione rapida “Ultimo Trimestre” usa l’ultimo trimestre fiscale concluso: gennaio-marzo, aprile-giugno, luglio-settembre, ottobre-dicembre.

## Importazione spese da Excel/ODS

La sezione **Spese** include il pulsante **Importa Excel**. La procedura accetta file `.xlsx`, `.xls` e `.ods` con colonne come:

- Data ordine
- Fornitore / Esercente
- Categoria
- Descrizione
- Costo
- Data pagamento
- Aliquota IVA
- Canale Pagamento
- Banca
- Pagamento completato
- Detrazione
- Fattura elettronica
- Stato fattura
- Pagamento effettuato da

Prima dell’import puoi attivare **Elimina tutte le spese prima di importare**. Questa opzione elimina le voci spesa già presenti, ma lascia invariati fornitori, incassi e configurazioni.

Regola specifica: quando nel file `Stato fattura = Ok`, il gestionale importa lo stato come **Emessa SDI** se `Fattura elettronica = Si`, oppure come **Emessa** se `Fattura elettronica = No`.

Import da terminale:

```bash
npm run import:expenses -- ./file.ods
npm run import:expenses -- ./file.ods --clear
```

## Tracciamento prodotti

Nel dettaglio, cliccare su un allegato ne scarica il file; i pulsanti Modifica ed Elimina restano indipendenti. Ogni sezione offre **Scarica tutti** per ottenere uno ZIP separato di fatture o documenti di tracciamento, fino a 50 MB. Se un file non è disponibile, l’archivio non viene creato parzialmente.

La voce **Tracciamento prodotti** nel menu laterale apre `/product-trackings`.
Le tracciature appartengono all’azienda attiva e comprendono nome e lotto obbligatori,
alias e data ingresso facoltativi, fino a 5 fatture e 5 documenti di tracciamento.
Ogni fattura richiede la propria data. Sono ammessi i formati già supportati dagli
allegati dell’app, fino a 10 MB per file.

Le fatture si aggiungono singolarmente con **Aggiungi fattura**: documento e data
obbligatoria, poi **Conferma**. Nel form diventano record modificabili o eliminabili
prima del salvataggio della tracciatura. Dal dettaglio, **Aggiungi fattura** apre la
modale di modifica sopra il dettaglio, senza cambiare pagina, al passaggio Fatture con un nuovo record da compilare; modifica
ed eliminazione delle fatture esistenti salvano subito la singola operazione. La modifica permette di aggiornare la data o sostituire il file.
I documenti di tracciamento seguono lo stesso flusso con **Aggiungi documento**,
**Conferma**, **Modifica** ed **Elimina**, con una **Data documento** obbligatoria per ogni allegato. Dal dettaglio l’aggiunta
apre la modale sopra la pagina al secondo passaggio; i documenti già presenti
si possono sostituire o eliminare singolarmente.

Su mobile il form usa tre passaggi: Merce, Documenti di tracciamento e Fatture.
I dati e i file restano in memoria passando avanti e indietro; gli allegati sono
facoltativi e il salvataggio avviene soltanto all’ultimo passaggio.

La lista offre ricerca per nome/lotto/alias, filtri avanzati e quattro contatori
cliccabili: fattura mancante, documento di tracciamento mancante, ultima fattura
oltre sei mesi e ingresso oltre sei mesi. I contatori seguono i filtri correnti;
le soglie usano mesi di calendario e la data corrente nel fuso orario dell’azienda.
Il collegamento a più spese è previsto per un aggiornamento successivo.

Per aggiornare un database esistente usare le migrazioni, includendo
`20261013180000_product_trackings`, e rigenerare il client Prisma:

```bash
npx prisma migrate deploy
npm run db:generate
```

### Esportazione della ricerca di spese e incassi

Nelle liste principali di spese e incassi, il pulsante **Esporta CSV** nella action bar e nella floating bar esporta tutti i risultati della ricerca corrente, indipendentemente dalle checkbox. Sostituisce il pulsante diretto Copia, che resta disponibile nel menu Azioni. La voce **Esporta selezionati** nel menu mantiene l’esportazione dei soli ID selezionati e il limite di 5.000 record. L’export della ricerca non tronca i risultati; gli scontrini raggruppati nella lista incassi sono esportati come singoli record. Filtri, società e permessi vengono applicati lato server.

### Registratore di cassa con più importi

Il registratore consente di preparare uno scontrino con più importi, ognuno fiscale (IVA 0%, 4%, 10%, 22%) o non fiscale. Data, categoria contabile, canale di vendita e descrizione sono comuni allo scontrino. Dopo **Aggiungi**, il display mostra il totale provvisorio e il pannello scorre ai metodi di incasso; digitando un nuovo importo torna al pannello IVA. Azzerare il nuovo importo conserva le righe già aggiunte. **Annulla ultimo inserimento** riporta l’ultima riga in digitazione. La scelta del metodo apre il riepilogo; solo **INCASSA** salva un documento con un accredito e tutte le righe, in transazione. Gli scontrini che includono importi non fiscali richiedono contanti.

I dati di dettaglio sono in `IncomeReceiptLine`; i subtotali fiscali e IVA sono salvati sull’incasso per mantenere corretti i report. I vecchi scontrini senza righe sono letti come documenti con un solo importo. Modifica e copia utilizzano il registratore e preservano le righe; la conversione diretta di uno scontrino con più importi è bloccata per evitare la perdita delle aliquote. Il CSV Scontrini v2 conserva importi e categoria, mantenendo l’importazione del formato v1. L’export generale degli incassi include gli importi dello scontrino in una colonna JSON.

La migrazione `20261014190000_cash_register_lines` va applicata prima di utilizzare il nuovo codice; rigenerare il client Prisma. I test del database usano uno schema temporaneo isolato (`RECEIPT_TEST_DATABASE=1`).

### Date dei documenti di tracciamento

Applicare la migrazione `20261019190000_tracking_document_date` e rigenerare il client Prisma prima di utilizzare il nuovo codice. Ogni documento di tracciamento richiede una propria Data documento, modificabile anche senza sostituire il file. I documenti storici conservano la data vuota e mostrano “Data documento mancante”: la data va compilata alla modifica del documento o al salvataggio del form completo della tracciatura. Non vengono assegnate date automatiche.

### Anno del lotto

Ogni tracciatura richiede un Anno del lotto (intero di quattro cifre), distinto dalla Data ingresso. Le nuove tracciature propongono l’anno corrente nel fuso dell’azienda e lasciano Data ingresso vuota. La migrazione `20261019200000_tracking_batch_year` assegna ai record esistenti l’anno corrente nel fuso aziendale e rende il campo obbligatorio. Anno è visibile nel form dopo Lotto, nella tabella ordinabile, nella lista mobile e nel dettaglio.
