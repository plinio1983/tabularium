import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import * as rules from '../lib/record-conversion';

const require = createRequire(import.meta.url);
const choiceModule: any = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../components/ExpenseTypeChoice.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
}).outputText, {exports: choiceModule, require});
const ExpenseTypeChoice = choiceModule.default;
const source = ts.transpileModule(readFileSync(new URL('../components/RecordConversionForm.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}
}).outputText;
function nodes(tree: any): any[] {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
}
function setup(kind: 'expenses' | 'incomes' = 'expenses') {
    const state: any[] = [], refs: any[] = [], navigation: any[] = [];
    let stateIndex = 0, refIndex = 0;
    const exports: any = {};
    runInNewContext(source, {exports, require: (name: string) => {
        if (name === 'react') return {
            useState: (initial: unknown) => {
                const index = stateIndex++;
                if (!(index in state)) state[index] = initial;
                return [state[index], (value: unknown) => {state[index] = value;}];
            },
            useRef: (initial: unknown) => refs[refIndex++] ?? (refs[refIndex - 1] = {current: initial})
        };
        if (name === 'next/navigation') return {useRouter: () => ({replace: (...args: any[]) => navigation.push(args)})};
        if (name === '@/lib/record-conversion') return rules;
        if (name === 'react/jsx-runtime') return require(name);
        return {__esModule: true, default: name};
    }});
    return {navigation, render() {
        stateIndex = 0; refIndex = 0;
        return exports.default({kind, id: 12, snapshot: 'snapshot', sourceType: 'STANDARD', returnHref: '/expenses/12?returnTo=%2Fexpenses', formProps: {
            initialExpense: {id: 12, amount: '123', expenseType: 'STANDARD', payments: [{id: 5, amount: '10'}]},
            categories: [], banks: [], paymentMethods: [], suppliers: []
        }});
    }};
}

test('conversion opens in a modal, requires a target and preserves form data when returning to the choice', () => {
    const app = setup();
    let tree = app.render();
    assert.equal(tree.type, './RecordConversionModal');
    let all = nodes(tree);
    assert.equal(all.some(node => node.type === 'select'), false);
    const choice = all.find(node => node.type === './ExpenseTypeChoice');
    assert.deepEqual([...choice.props.availableTypes], ['payroll', 'tax']);
    assert.equal(choice.props.showCounter, false);
    assert.equal(all.find(node => node.type === './MobileFormStickyActions').props.nextDisabled, true);
    choice.props.onSelect('payroll');
    all = nodes(app.render());
    // Desktop exposes the fields immediately; only the mobile stylesheet gates the stage.
    assert.equal(all.find(node => node.type === 'fieldset').props.hidden, undefined);
    assert.equal(all.find(node => node.props?.className?.includes('expense-creation-stage')).props.className.includes('is-confirmed'), false);
    const next = all.find(node => node.type === './MobileFormStickyActions');
    assert.equal(next.props.nextDisabled, false);
    next.props.onNext();
    all = nodes(app.render());
    assert.equal(all.find(node => node.type === './ExpenseTypeStep').props.hidden, undefined);
    const form = all.find(node => node.type === '@/components/ExpenseForm');
    assert.equal(form.props.initialExpense.expenseType, 'PAYROLL');
    assert.equal(form.props.initialExpense.payrollNetAmount, '123');
    assert.equal(form.props.initialExpense.payments[0].id, 5);
    assert.equal(form.props.preserveLinkedRecords, true);
    assert.equal(form.props.hideMobileActions, false);
    assert.equal(form.props.mobileStepOffset, 1);
    form.props.onBackToType();
    all = nodes(app.render());
    assert.equal(all.find(node => node.type === './ExpenseTypeChoice').props.selected, 'payroll');
    assert.equal(all.find(node => node.type === '@/components/ExpenseForm').props.hideMobileActions, true);
    form.props.onCancel();
    assert.equal(app.navigation[0][0], '/expenses/12?returnTo=%2Fexpenses');
    assert.equal(app.navigation[0][1].scroll, false);
});

test('shared type cards filter conversion targets without changing the creation selector', () => {
    const conversion = renderToStaticMarkup(createElement(ExpenseTypeChoice, {availableTypes: ['payroll', 'tax'], showCounter: false, onSelect() {}}));
    assert.match(conversion, /Busta paga/);
    assert.match(conversion, /Imposte/);
    assert.doesNotMatch(conversion, /Saldo IVA|Da banco|Spesa occasionale/);
    const creation = renderToStaticMarkup(createElement(ExpenseTypeChoice, {selected: 'single', onSelect() {}}));
    assert.match(creation, /Saldo IVA/);
    assert.match(creation, /Da banco/);
    assert.match(creation, /Spesa occasionale/);
});

test('income conversion retains its existing page and selector', () => {
    const tree = setup('incomes').render();
    assert.equal(tree.type, 'div');
    assert.ok(nodes(tree).some(node => node.type === 'select'));
});
