import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file: string, mocks: Record<string, unknown>, globals = {}) {
    const exports: {default?: any} = {};
    const compiled = ts.transpileModule(readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8'), {
        compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
    }).outputText;
    runInNewContext(compiled, {exports, require: (name: string) => mocks[name] ?? require(name), ...globals});
    return exports.default;
}

test('Il dettaglio entrata usa lo stato AJAX della propria ricorrenza per tutti gli indicatori', () => {
    const DetailState = load('RecurringDetailState', {
        './RecurringStateProvider': {useRecurringStates: () => ({records: {
            'income:42': {active: false, archived: false}, 'expense:42': {active: true, archived: false}
        }})},
        '@/lib/expense-ui': {badgeClass: (tone: string) => `badge ${tone}`}
    });
    const props = {kind: 'income', id: 42, active: true, archived: false};
    for (const [variant, expected] of [['badge', 'OFF'], ['summary', 'Regola disattivata'], ['text', 'Disattivata'], ['progress', 'width:0%']]) {
        assert.ok(renderToStaticMarkup(createElement(DetailState, {...props, variant})).includes(expected));
    }
    assert.ok(renderToStaticMarkup(createElement(DetailState, {...props, kind: 'expense', variant: 'badge'})).includes('ON'));
});

test('Modifica da pulsante chiude il menu e apre i dati con lo stato AJAX corrente', () => {
    const changes: any[] = [];
    let closed = false;
    class Element {
        tagName = 'BUTTON';
        dataset = {recurringIncomeEditId: '42'};
        closest(selector: string): any {
            return selector === 'details' ? {removeAttribute: () => {closed = true;}} : this;
        }
        focus() {}
    }
    const Modal = load('RecurringIncomeEditModal', {
        react: {useState: (initial: unknown) => [initial, (value: unknown) => changes.push(value)]},
        'next/navigation': {useRouter: () => ({refresh() {}})},
        './RecurringIncomeForm': {default: () => null},
        './RecurringStateProvider': {useRecurringStates: () => ({records: {'income:42': {active: false, archived: false}}})}
    }, {Element});
    const tree = Modal({items: [{id: 42, isActive: true}], children: null});
    let prevented = false;
    tree.props.onClickCapture({target: new Element(), preventDefault() {prevented = true;}, stopPropagation() {}});
    assert.equal(prevented, true);
    assert.equal(closed, true);
    assert.equal(changes.at(-1).id, 42);
    assert.equal(changes.at(-1).isActive, false);
});
