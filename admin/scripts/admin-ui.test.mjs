import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

/** Loads the actual dependency-free presentation component with the project's installed compiler. */
function load(name) {
  const filename = new URL(`../src/features/admin/components/${name}.tsx`, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, require: createRequire(import.meta.url) });
  return module.exports[name];
}
const StatusBadge = load('StatusBadge'), AdminIcon = load('AdminIcon');

test('negative and unknown states never inherit a positive substring tone', () => {
  for (const value of ['Inactive', 'Unpaid', 'Unverified', 'UnknownActive', 'Unknown', 999]) {
    const html = renderToStaticMarkup(createElement(StatusBadge, { value }));
    assert.match(html, /admin-badge-gray admin-badge-neutral/);
    assert.doesNotMatch(html, /admin-badge-green|admin-badge-info/);
  }
});

test('all current commerce states have exact semantic tones and keep locale labels', () => {
  for (const [value, tone] of [['Active', 'green'], ['InStock', 'green'], ['Paid', 'green'], ['Verified', 'green'], ['Delivered', 'green'],
    ['PendingPayment', 'yellow'], ['Draft', 'yellow'], ['LowStock', 'yellow'], ['Processing', 'blue'], ['Packed', 'blue'], ['Shipped', 'blue'], ['Redirected', 'blue'],
    ['Cancelled', 'red'], ['Refunded', 'red'], ['OutOfStock', 'red'], ['Failed', 'red']]) {
    assert.match(renderToStaticMarkup(createElement(StatusBadge, { value })), new RegExp(`admin-badge-${tone}`));
    assert.match(renderToStaticMarkup(createElement(StatusBadge, { value, locale: 'en' })), new RegExp(`>${value}</span>`));
  }
  assert.match(renderToStaticMarkup(createElement(StatusBadge, { value: 'Inactive' })), /غیرفعال/);
  assert.match(renderToStaticMarkup(createElement(StatusBadge, { value: 'Pending Payment' })), /در انتظار پرداخت/);
});

test('semantic arrows point directly in the requested direction without CSS rotations', () => {
  for (const [direction, path] of [['right', 'm9 18 6-6-6-6'], ['left', 'm15 18-6-6 6-6'], ['down', 'm6 9 6 6 6-6']]) {
    const html = renderToStaticMarkup(createElement(AdminIcon, { name: 'chevron', direction }));
    assert.ok(html.includes(`d="${path}"`));
    assert.ok(html.includes(`data-icon-direction="${direction}"`));
    assert.doesNotMatch(html, /transform/);
  }
  const html = renderToStaticMarkup(createElement(AdminIcon, { name: 'search' }));
  assert.doesNotMatch(html, /data-icon-direction/);
  assert.match(html, /circle/);
});

test('new semantic menu icons are distinct and use the existing stroke system', () => {
  const icons = ['accounting', 'colors', 'attributes', 'seo'].map(name => renderToStaticMarkup(createElement(AdminIcon, { name })));
  assert.equal(new Set(icons).size, 4);
  for (const html of icons) { assert.match(html, /stroke="currentColor"/); assert.match(html, /aria-hidden="true"/); }
});

/** Computes WCAG relative luminance for the palette's opaque sRGB hex colors. */
function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test('shared text/status colors meet 4.5:1 and control/focus boundaries meet 3:1', () => {
  const css = readFileSync(new URL('../src/features/admin/styles/admin-penpot.css', import.meta.url), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--va-([\w-]+):\s*(#[\da-f]{6});/gi)].map(m => [m[1], m[2]]));
  const pairs = [['ink', 'surface'], ['muted', 'surface'], ['muted', 'surface-2'], ['muted', 'surface-3'], ['green', 'green-soft'], ['blue', 'blue-soft'], ['amber', 'amber-soft'], ['red', 'red-soft'], ['brass-dark', 'surface'], ['brass-dark', 'brass-soft']];
  for (const [foreground, background] of [...pairs, ['control-border', 'surface'], ['brass-dark', 'canvas']]) {
    const a = luminance(tokens[foreground]), b = luminance(tokens[background]);
    const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const minimum = foreground === 'control-border' ? 3 : 4.5;
    assert.ok(contrast >= minimum, `${foreground}/${background}: ${contrast.toFixed(2)} < ${minimum}`);
  }
});
