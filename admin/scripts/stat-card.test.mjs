import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const filename = new URL('../src/features/admin/components/StatCard.tsx', import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  fileName: filename.pathname,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const component = { exports: {} };
vm.runInNewContext(compiled, { exports: component.exports, require: createRequire(import.meta.url) });

/** Renders the actual typed shared component without requiring a DOM or another test dependency. */
function render(props) {
  return renderToStaticMarkup(createElement(component.exports.StatCard, { title: 'فروش تأییدشده', tone: 'blue', ...props }));
}

test('currency is a separate readable unit without changing the provided amount', () => {
  const html = render({ value: '۴۲۹٬۰۰۰٬۰۰۰', unit: 'تومان' });
  assert.match(html, /<strong><span class="admin-stat-value">۴۲۹٬۰۰۰٬۰۰۰<\/span> <span class="admin-stat-unit">تومان<\/span><\/strong>/);
  assert.match(html, /فروش تأییدشده/);
});

test('existing count-only cards keep their complete value and do not render an empty unit', () => {
  const html = render({ title: 'کل سفارش‌ها', value: '۱٬۲۸۴' });
  assert.match(html, /<strong><span class="admin-stat-value">۱٬۲۸۴<\/span><\/strong>/);
  assert.doesNotMatch(html, /admin-stat-unit/);
});

test('large values, English labels and subtitles remain intact', () => {
  const html = render({ title: 'Verified sales', value: '12,980,000,000', unit: 'Toman', subtitle: 'Verified payments only' });
  assert.match(html, /12,980,000,000/);
  assert.match(html, /Toman/);
  assert.match(html, /<small>Verified payments only<\/small>/);
});

test('plain values are escaped rather than interpreted as markup', () => {
  assert.match(render({ value: '<b>100</b>' }), /&lt;b&gt;100&lt;\/b&gt;/);
});

test('Persian typography keeps the original Vazirmatn family and real medium/semibold/bold assets', () => {
  const css = readFileSync(new URL('../src/features/admin/styles/admin.css', import.meta.url), 'utf8');
  for (const [weight, variant] of [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']]) {
    assert.match(css, new RegExp(`@font-face\\s*\\{[^}]*font-family: "Vazirmatn";[^}]*font-weight: ${weight};[^}]*Vazirmatn-${variant}\\.ttf`, 's'));
    assert.ok(statSync(new URL(`../public/fonts/vazirmatn/Vazirmatn-${variant}.ttf`, import.meta.url)).size > 1000);
  }
  const dashboard = readFileSync(new URL('../src/features/admin/styles/admin-penpot.css', import.meta.url), 'utf8');
  assert.doesNotMatch(dashboard, /\.admin-dashboard-page[^}]*font-weight: 800/s);
});
