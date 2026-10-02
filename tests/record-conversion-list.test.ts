import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../components/RecordConversionListController.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
}).outputText;

function setup() {
    const state: any[] = [], refs: any[] = [], effects: Array<() => void> = [];
    let stateIndex = 0, refIndex = 0;
    const exports: any = {};
    const listeners = new Map<string, (event: any) => Promise<void>>();
    const calls: Array<{url: string; signal: AbortSignal}> = [];
    let response: ((value: unknown) => void) | undefined;
    runInNewContext(code, {exports, AbortController, Error, require: (name: string) => {
        if (name === 'react') return {
            useState(initial: unknown) {
                const index = stateIndex++;
                if (!(index in state)) state[index] = initial;
                return [state[index], (value: unknown) => {state[index] = value;}];
            },
            useRef: (initial: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = {current: initial}),
            useCallback: (callback: unknown) => callback,
            useEffect: (effect: () => void) => {effects.push(effect);}
        };
        if (name === 'react/jsx-runtime') return require(name);
        return {default: name};
    }, document: {addEventListener: (name: string, callback: any) => listeners.set(name, callback), removeEventListener: (name: string) => listeners.delete(name)},
    fetch: (url: string, options: {signal: AbortSignal}) => {
        calls.push({url, signal: options.signal});
        return new Promise(resolve => {response = resolve;});
    }});
    return {
        calls,
        render() {
            stateIndex = 0; refIndex = 0;
            return exports.default({kind: 'expenses', formId: 'expenseBulkForm', returnHref: '/expenses?search=test'});
        },
        mount() {effects[0]();},
        open(detail: unknown) {return listeners.get('record-conversion:open')!({detail});},
        respond(ok = true) {response!({ok, json: async () => ok ? {kind: 'expenses', id: 7, snapshot: 'abc'} : {error: 'Permessi insufficienti'}});}
    };
}

test('list conversion fetches the form in place and retains the original list destination', async () => {
    const app = setup();
    assert.equal(app.render(), null);
    app.mount();
    await app.open({kind: 'incomes', formId: 'expenseBulkForm', id: 7});
    await app.open({kind: 'expenses', formId: 'otherForm', id: 7});
    assert.equal(app.calls.length, 0);
    const opened = app.open({kind: 'expenses', formId: 'expenseBulkForm', id: 7});
    assert.equal(app.calls[0].url, '/api/expenses/7/convert');
    assert.equal(app.render().type, './RecordConversionModal');
    app.respond();
    await opened;
    const form = app.render();
    assert.equal(form.type, './RecordConversionForm');
    assert.equal(form.props.returnHref, '/expenses?search=test');
    form.props.onSaved();
    assert.equal(app.render(), null);
});

test('closing during loading aborts the request and prevents a late response from reopening the modal', async () => {
    const app = setup(); app.render(); app.mount();
    const opened = app.open({kind: 'expenses', formId: 'expenseBulkForm', id: 7});
    app.render().props.onClose();
    assert.equal(app.calls[0].signal.aborted, true);
    app.respond();
    await opened;
    assert.equal(app.render(), null);
});
