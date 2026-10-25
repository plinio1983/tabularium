import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('lib/prisma.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
function load(cache: any, datamodel: any) {
  let created = 0;
  const exports: any = {};
  const mocks: Record<string, unknown> = {
    'dotenv/config': {},
    '@prisma/adapter-pg': {PrismaPg: class {}},
    '../generated/prisma/client': {Prisma: {ModelName: {ProductTracking: 'ProductTracking'}, ProductTrackingScalarFieldEnum: datamodel}, PrismaClient: class {generation = ++created;}},
    './database-url': {getDatabaseUrl: () => 'postgresql://localhost/test'},
  };
  runInNewContext(source, {exports, require: (id: string) => mocks[id], globalThis: cache, process: {env: {NODE_ENV: 'development'}}});
  return {client: exports.prisma, created};
}

test('hot reload replaces cached clients when generated schema changes, including legacy unversioned clients', () => {
  const old = {id: 'old client'};
  const datamodel = {models: [{name: 'ProductTracking', fields: [{name: 'inStock', type: 'Boolean'}]}]};
  for (const cache of [{prisma: old}, {prisma: old, prismaSchema: 'previous schema'}]) {
    const result = load(cache, datamodel);
    assert.equal(result.created, 1);
    assert.notEqual(result.client, old);
    assert.equal(cache.prisma, result.client);
    assert.equal(load(cache, datamodel).created, 0);
  }
});
