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
