import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {periodOptions} from '../lib/period-selector';

// Exercise the actual date resolvers used by pages and editable drawers.
for (const [path, name, hasYear] of [
  ['app/expenses/page.tsx', 'getQuickDateRange', true],
  ['app/incomes/page.tsx', 'getQuickDateRange', true],
  ['components/ExpenseFiltersDrawer.tsx', 'quickOrderDateRange', false],
  ['components/IncomeFiltersDrawer.tsx', 'quickDateRange', false],
] as const) {
  test(`${path}: tutti i periodi non impone limiti alle date`, () => {
    const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name)!;
    assert.ok(declaration);
    const compiled = ts.transpileModule(`${declaration.getText(source)}\nexports.range = ${name};`, {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
    }).outputText;
    const exports: any = {};
    runInNewContext(compiled, {exports, Date});
    const now = new Date('2026-10-05T12:00:00Z');
    const result = hasYear ? exports.range('all', '2026', now) : exports.range('all', now);
    assert.equal(result.from, '');
    assert.equal(result.to, '');
    assert.ok(periodOptions.some(([value]) => value === 'all'));
  });
}
