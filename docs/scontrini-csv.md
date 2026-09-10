# CSV scontrini

Dalla lista Scontrini selezionare i record e scegliere **Azioni → Esporta CSV**. Il file comprende soltanto i record selezionati della società corrente, non i cumulativi della lista Incassi. Lista, export e import sono limitati a 1.000 righe; restringere il periodo per archivi più grandi.

In **Importa dati → Scontrini (CSV)** caricare il file, scegliere **Analizza file**, verificare l'anteprima e confermare. Errori o conflitti bloccano tutto il file. La conferma rilegge dati e configurazione: se l'anteprima è cambiata, è richiesta una nuova analisi. Non è prevista la cancellazione o sovrascrittura dello storico. Anche la cancellazione preventiva dell'importazione Incassi standard conserva gli scontrini.

## Formato versione 1

UTF-8 (BOM facoltativo), separatore `;`, virgolette doppie e ritorni a capo nei campi supportati; massimo 5 MB. Il modello è disponibile dall'interfaccia e da `GET /api/cash-register/receipts/import` (autenticazione richiesta).

Le colonne, nell'ordine del modello, sono: Versione; Identificativo origine; Data e ora; Descrizione; Importo; Fiscale; IVA %; Codice canale; Canale di vendita; Metodo pagamento; Banca; Periodo contabile; Note.

- Versione: `1`.
- Identificativo origine: obbligatorio, stabile, diverso per ogni vendita, massimo 180 caratteri. Non modificarlo nelle successive importazioni dello stesso scontrino. Due vendite identiche con identificativi distinti restano due vendite.
- Data e ora: ISO 8601 con offset o UTC, ad esempio `2026-10-25T02:30:00+02:00`. Conserva l'istante anche durante il cambio dell'ora.
- Importo: positivo, fino a 999999999,99, massimo due decimali, nessun separatore delle migliaia; virgola o punto decimale.
- Fiscale: Sì/No (accettati anche true/false); IVA: 0, 4, 10, 22. Non fiscale richiede IVA zero e metodo contanti.
- Canale: codice configurato oppure nome univoco; se entrambi sono compilati devono corrispondere. Metodo e banca: nomi configurati nel workspace. Il metodo deve essere abilitato al registratore. Nessuna creazione o sostituzione automatica dei riferimenti.
- Banca: conto effettivo dello scontrino; non viene ricalcolato dalle regole attuali di instradamento.
- Periodo contabile: AAAA-MM, anni 1900–2199, conservato dal file.
- Descrizione: facoltativa, massimo 200 caratteri; note: massimo 10.000. I testi esportati con prefissi pericolosi per i fogli di calcolo sono protetti con un apostrofo reversibile. Anche gli apostrofi iniziali letterali vengono protetti per distinguerli.

L'import crea un Income CASH_REGISTER con il cliente di sistema e un unico IncomeCredit dell'intero importo, nella stessa transazione. Lo stato è accreditato; la fattura è EMESSA per i fiscali e assente per i non fiscali. Non è un backup generale di allegati, metadati o storico delle modifiche. Export di scontrini con accrediti incoerenti viene bloccato con un messaggio.

## Identità e concorrenza

Gli scontrini nativi esportano `request:<cashRegisterRequestId>`; i record storici privi di request ID usano `legacy:<workspace>:<società>:<id>`. Gli import memorizzano `csv:<società destinazione>:<origine>` nel campo cashRegisterRequestId esistente. La riesportazione recupera l'origine, senza aggiungere prefissi. Il vincolo unico workspace/request ID protegge anche gli inserimenti concorrenti, senza migrazioni.

Stessa origine e stessi dati: duplicato ignorato. Stessa origine e dati diversi: conflitto da risolvere nel file, senza aggiornamenti automatici. Il controllo è limitato alla società e al workspace correnti. Il token di anteprima contiene un digest del piano e del contesto; non sostituisce l'autorizzazione. Il server ricalcola il piano nella transazione Serializable e verifica il digest prima delle scritture. Errori e conflitti concorrenti annullano tutte le scritture; il log di import è nella stessa transazione.

## Verifica

`node --import tsx --test tests/receipt-csv.test.ts`

`RECEIPT_TEST_DATABASE=1 node --import tsx --test tests/receipt-import.test.ts`

Il test PostgreSQL usa e rimuove uno schema isolato, con sequenze proprie; verifica reimportazione, isolamento, conflitti, precisione, coerenza degli accrediti e rollback dopo un errore a metà importazione.
