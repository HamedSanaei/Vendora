/* Dependency-free assertions using the installed TypeScript compiler and actual frontend modules. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

/** Loads one real TS/JS module with explicit boundary stubs; it never starts a server or calls an API. */
function load(relative, dependencies = {}) {
  const filename = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, URL, URLSearchParams, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename });
  return exports;
}

const http = { resolveApiImageUrl: value => new URL(value, 'https://example.invalid').href };
const { mapCatalogProduct } = load('site/src/lib/catalog-product-mapping.ts', { './http': http });
const { toCatalogProduct } = load('site/src/components/vendora/catalog/catalog-types.ts');
const { productSchema } = load('site/src/lib/catalog-seo.ts', { './http': http });
const dto = { id: 'stable-guid', productCode: 100, title: 'City bag', slug: 'seed-bestseller-city-tote',
  price: 250000, stockQuantity: 3, images: [], categories: [], colors: [] };
const mapped = mapCatalogProduct(dto);
assert.equal(mapped.sku, '100');
assert.equal(mapped._id, dto.id);
assert.equal(mapped.slug, dto.slug);
assert.equal(toCatalogProduct(mapped).sku, '100');
assert.equal(toCatalogProduct({ ...mapped, sku: dto.slug }).sku, '100');
const schema = productSchema(dto, { siteUrl: 'https://example.invalid', siteName: 'Vendora' });
assert.equal(schema['@graph'][1].sku, '100');

const formatters = load('admin/src/features/admin/utils/formatters.ts');
let query = '۱۰۰';
const { useAdminProductQuery } = load('admin/src/features/admin/hooks/useAdminProductQuery.ts', {
  react: { useMemo: fn => fn() },
  'react-router-dom': { useSearchParams: () => [new URLSearchParams({ q: query }), () => {}] },
  '../utils/formatters': formatters,
});
const products = [{ productCode: 101, title: '100 title match', slug: 'other', categoryIds: [], status: 'Active' },
  { productCode: 100, title: 'City bag', slug: dto.slug, categoryIds: [], status: 'Active' }];
for (query of ['100', '۱۰۰', '١٠٠']) {
  assert.equal(useAdminProductQuery(products, 10).pageItems[0].productCode, 100);
}
query = '99999';
assert.equal(useAdminProductQuery(products, 10).totalItems, 0);

let persisted;
const { cartSlice } = load('site/src/redux/features/cartSlice.js', {
  '@reduxjs/toolkit': { createSlice: options => ({ ...options, actions: {} }) },
  '@utils/localstorage': { getLocalStorage: () => [], setLocalStorage: (name, items) => { persisted = { name, items }; } },
});
const state = { cart_products: [{ ...mapped, productCode: undefined, sku: dto.slug, orderQuantity: 2 }], orderQuantity: 1 };
cartSlice.reducers.sync_cart_prices(state, { payload: [mapped] });
assert.equal(state.cart_products[0].sku, '100');
assert.equal(state.cart_products[0].productCode, 100);
assert.equal(state.cart_products[0]._id, dto.id);
assert.equal(state.cart_products[0].orderQuantity, 2);
assert.equal(persisted.name, 'cart_products');
console.log('Product code frontend checks passed: mapping, schema, admin digit search and legacy cart metadata.');
