import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function harness(initialValue = '') {
  const state: any[] = [];
  const refs: any[] = [];
  let cursor = 0, refCursor = 0, value = initialValue;
  const employees = [
    {id: 1, firstName: 'Mario', lastName: 'Rossi', employeeCode: 'D001', status: 'ACTIVE'},
    {id: 2, firstName: 'Anna', lastName: 'Verdi', employeeCode: 'D002', status: 'INACTIVE'},
  ];
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(new URL('../components/EmployeeAutocomplete.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  runInNewContext(source, {exports, require: (id: string) => id === 'react' ? {
    useState(initial: any) {const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (next: any) => {state[index] = typeof next === 'function' ? next(state[index]) : next;}];},
    useRef(initial: any) {const index = refCursor++; return refs[index] ?? (refs[index] = {current: initial});},
    useMemo: (fn: any) => fn(), useEffect() {}, useId: () => 'employees',
  } : require(id)});
  function nodes(tree: any): any[] {return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];}
  return () => {cursor = 0; refCursor = 0; return nodes(exports.default({employees, value, onChange: (next: string) => {value = next;}}));};
}

test('employee autosuggest selects an existing employee and clears the id when text changes', () => {
  const render = harness();
  let tree = render();
  tree.find(node => node.props.role === 'combobox').props.onFocus();
  tree = render();
  assert.equal(tree.filter(node => node.props.role === 'option').length, 1);
  tree.find(node => node.props.role === 'option').props.onMouseDown({preventDefault() {}});
  tree = render();
  assert.equal(tree.find(node => node.props.name === 'employeeId').props.value, '1');
  assert.equal(tree.find(node => node.props.role === 'combobox').props.value, 'Rossi Mario');
  let validity = '';
  tree.find(node => node.props.role === 'combobox').props.onChange({currentTarget: {value: 'Mario D001', setCustomValidity(message: string) {validity = message;}}});
  tree = render();
  assert.equal(tree.find(node => node.props.name === 'employeeId').props.value, '');
  assert.ok(validity);
  assert.equal(tree.filter(node => node.props.role === 'option').length, 1);
  let prevented = false;
  tree.find(node => node.props.role === 'combobox').props.onKeyDown({key: 'Enter', preventDefault() {prevented = true;}});
  assert.ok(prevented);
  assert.equal(render().find(node => node.props.name === 'employeeId').props.value, '1');
});

test('employee autosuggest preserves an inactive employee already selected in an edit', () => {
  const render = harness('2');
  const input = render().find(node => node.props.role === 'combobox');
  assert.equal(input.props.value, 'Verdi Anna');
  input.props.onFocus();
  const options = render().filter(node => node.props.role === 'option');
  assert.equal(options.length, 1);
  assert.equal(options[0].props['aria-selected'], true);
});
