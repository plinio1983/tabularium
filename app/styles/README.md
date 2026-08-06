# Organizzazione SCSS

`_index.scss` e l'unico manifest della cascata globale. I moduli sono caricati
in questo ordine:

1. `foundation`: reset, custom properties e utility di base;
2. `layout`: shell, navigazione e struttura delle pagine;
3. `components`: primitive riutilizzabili, wizard e form condivisi;
4. `features`: stili legati a un contesto applicativo;
5. `responsive`: specializzazioni mobile e desktop.

## Regole di manutenzione

- Una nuova regola va nel modulo del componente o della feature proprietaria.
- Le media query specifiche di un componente possono restare accanto alla
  regola base; `responsive` raccoglie gli override trasversali ancora condivisi.
- Non aggiungere nuovi blocchi cronologici (`vNN`, `fix`, `final override`):
  integrare la modifica nel contesto proprietario.
- L'ordine degli `@use` non va cambiato senza un confronto dell'output CSS e
  una verifica visiva delle pagine coinvolte.
