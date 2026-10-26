import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/features/admin/utils/product-sort.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} }; vm.runInNewContext(code, { exports: module.exports, Intl });
const { sortAdminProducts, normalizeProductSort } = module.exports;
const products = [
  { id: 'a', productCode: 100, title: 'Bag 2', price: 20, stockQuantity: 5, createdAtUtc: '2026-01-01T00:00:00Z', updatedAtUtc: '2026-03-01T00:00:00Z' },
  { id: 'b', productCode: 101, title: 'Bag 10', price: 10, stockQuantity: 0, createdAtUtc: '2026-01-02T00:00:00Z' },
  { id: 'c', productCode: 102, title: 'Bag 1', price: 30, stockQuantity: 10, createdAtUtc: '2026-01-03T00:00:00Z' },
];
/** Reads IDs into this realm so comparisons test values rather than VM array prototypes. */
function ids(rows) { return Array.from(rows, row => row.id); }

test('all eight sorts use their actual numeric/date/name values before pagination', () => {
  for (const [sort, expected] of [['newest',['c','b','a']],['oldest',['a','b','c']],['updated',['a','c','b']],['price-asc',['b','a','c']],['price-desc',['c','a','b']],['stock-asc',['b','a','c']],['stock-desc',['c','a','b']],['name',['c','a','b']]])
    assert.deepEqual(ids(sortAdminProducts(products, sort, '', 'en')), expected, sort);
  assert.deepEqual(ids(products), ['a','b','c'], 'Does not mutate the store array');
});
test('missing/invalid dates stay last in either date direction; ties remain deterministic', () => {
  const unknown = { ...products[0], id: 'missing', productCode: 103, createdAtUtc: null };
  const invalid = { ...unknown, id: 'invalid', productCode: 104, createdAtUtc: 'invalid' };
  assert.deepEqual(ids(sortAdminProducts([...products, unknown, invalid], 'oldest')), ['a','b','c','invalid','missing']);
  assert.deepEqual(ids(sortAdminProducts([...products, unknown, invalid], 'newest')), ['c','b','a','invalid','missing']);
  const tied=products.map(row=>({...row,price:10}));assert.deepEqual(ids(sortAdminProducts(tied,'price-asc')),['c','b','a']);
});
test('exact product-code search retains first position regardless of selected sort', () => {
  assert.deepEqual(ids(sortAdminProducts(products, 'price-asc', '102')), ['c','b','a']);
  assert.deepEqual(ids(sortAdminProducts(products, 'newest', '100')), ['a','c','b']);
});
test('unknown URL values safely normalize to newest', () => {
  for (const value of [null,'','price','__proto__']) assert.equal(normalizeProductSort(value),'newest');
  assert.equal(normalizeProductSort('oldest'),'oldest');
});
