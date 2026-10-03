import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Catch help controls drifting below headings or wrapping unrelated page content.
for (const file of ['app/page.tsx', 'app/suppliers/page.tsx', 'app/clients/page.tsx', 'app/employees/page.tsx', 'app/expenses/page.tsx', 'app/incomes/page.tsx']) {
  test(`${file}: titolo e aiuto condividono una riga senza contenuti estranei`, () => {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let rows = 0;
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'className' && attr.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text === 'info-title-row')) {
        rows++;
        const children = node.children.filter(child => !ts.isJsxText(child) || child.text.trim());
        const headings = children.slice(0, -1);
        assert.ok(headings.length === 1 || headings.length === 2, 'Solo titoli e icona devono essere nella riga');
        for (const heading of headings) {
          assert.ok(ts.isJsxElement(heading));
          assert.match(heading.openingElement.tagName.getText(source), /^h[23]$/);
        }
        if (headings.length === 2) {
          const classes = headings.map(heading => {
            assert.ok(ts.isJsxElement(heading));
            const attr = heading.openingElement.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'className');
            return attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : '';
          });
          assert.deepEqual(classes.sort(), ['hidden-sm-down', 'hidden-sm-up'], 'I titoli alternativi devono essere visibili su breakpoint complementari');
        }
        const hint = children.at(-1)!;
        assert.ok(ts.isJsxElement(hint));
        assert.equal(hint.openingElement.tagName.getText(source), 'InfoHint');
        assert.ok(hint.openingElement.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'compactOnly'), 'Il testo desktop deve rimanere fuori dalla riga');
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(rows > 0);
  });
}

for (const name of ['CompanyFormFields', 'SupplierFormFields', 'ClientFormFields', 'EmployeeFormFields', 'ExpenseForm', 'IncomeForm', 'RecurringExpenseForm', 'RecurringIncomeForm', 'AttachmentFormSection']) {
  test(`${name}: l’aiuto delle sezioni resta accanto alla label`, () => {
    const source = ts.createSourceFile(name, readFileSync(`components/${name}.tsx`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let rows = 0;
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'InfoHint' && ts.isJsxElement(node.parent) && node.parent.openingElement.tagName.getText(source) === 'summary') {
        assert.fail('L’icona non deve essere separata dalla label nel summary');
      }
      if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'className' && attr.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text === 'info-label-row')) {
        rows++;
        const children = node.children.filter(child => !ts.isJsxText(child) || child.text.trim());
        assert.equal(children.length, 2);
        assert.ok(ts.isJsxElement(children[1]));
        assert.equal(children[1].openingElement.tagName.getText(source), 'InfoHint');
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(rows > 0);
  });
}
