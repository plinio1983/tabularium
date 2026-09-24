import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../components/RecurringStateToggle.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
}).outputText;
const exports: {default?: any} = {};
runInNewContext(compiled, {exports, require: (name: string) => name === './RecurringStateProvider' ? {useRecurringStates: () => ({records: {}, update: () => {}})} : require(name)});

for (const kind of ['expense', 'income'] as const) {
  for (const active of [true, false]) {
    test(`${kind} ${active ? 'ON → OFF' : 'OFF → ON'} prepara ID, azione e filtri per il salvataggio in pagina`, () => {
      const path = `/recurring-${kind === 'expense' ? 'expenses' : 'incomes'}`;
      const returnTo = encodeURIComponent(`${path}?search=Canone&isActive=${active}`);
      const html = renderToStaticMarkup(createElement(exports.default, {kind, id: 42, active, archived: false, returnTo}));
      assert.ok(html.includes(`action="/api${path}/bulk?returnTo=${returnTo}"`));
      assert.match(html, /method="post"/);
      assert.match(html, /data-in-place-submit="true"/);
      assert.match(html, /type="hidden" name="ids" value="42"/);
      assert.ok(html.includes(`name="bulkAction" value="${active ? 'deactivate' : 'activate'}"`));
      assert.match(html, /type="submit"/);
      assert.equal((html.match(/ disabled=""/g) ?? []).length, 1);
      assert.match(html, /role="group"/);
      assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
      assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 1);
    });
  }
}

for (const kind of ['expense', 'income'] as const) {
  for (const success of [true, false]) {
    test(`${kind}: AJAX ${success ? 'aggiorna solo il record confermato' : 'conserva lo stato e mostra errore'}`, async () => {
      const updates: unknown[] = [], states: unknown[] = [], requests: any[] = [];
      const module: {default?: any} = {};
      const records = {[`${kind}:42`]: {active: false, archived: false}};
      runInNewContext(compiled, {
        exports: module,
        require: (name: string) => name === 'react' ? {useState: (initial: unknown) => [initial, (value: unknown) => states.push(value)]}
          : name === './RecurringStateProvider' ? {useRecurringStates: () => ({records, update: (...args: unknown[]) => updates.push(args)})}
          : require(name),
        FormData: class {constructor(form: object) {return form;}},
        fetch: async (...args: any[]) => {requests.push(args); return {ok: success, json: async () => success ? {ok: true, active: true} : {error: 'Ricorrenza scaduta'}};}
      });
      const element = module.default({kind, id: 42, active: true, archived: false, returnTo: ''});
      const body = new FormData(); body.set('ids', '42'); body.set('bulkAction', 'activate');
      let prevented = false;
      await element.props.onSubmit({preventDefault: () => {prevented = true;}, currentTarget: body});
      assert.equal(prevented, true);
      assert.equal(requests.length, 1);
      assert.equal(requests[0][1].headers.accept, 'application/json');
      assert.deepEqual(requests[0][1].body.getAll('ids'), ['42']);
      assert.equal(requests[0][1].body.get('bulkAction'), 'activate');
      assert.deepEqual(JSON.parse(JSON.stringify(updates)), success ? [[kind, 42, {active: true, archived: false}]] : []);
      assert.equal(states.at(-1), false);
      if (!success) assert.ok(states.includes('Ricorrenza scaduta'));
    });
  }
}
