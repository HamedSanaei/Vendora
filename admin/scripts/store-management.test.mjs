import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/features/admin/storeManagement.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};vm.runInNewContext(compiled,{exports:module.exports});
const {storeManagementSection:section,storeManagementSections:sections}=module.exports;
test('every configured scope is directly addressable and has both locale labels',()=>{
  assert.equal(new Set(Array.from(sections,item=>item.id)).size,8);
  for(const item of sections){assert.ok(item.fa&&item.en);assert.equal(section(new URLSearchParams({section:item.id})),item.id);}
});
test('legacy SMS bookmarks select SMS but an explicit scope takes precedence',()=>{
  assert.equal(section(new URLSearchParams('smsTab=history')),'sms');assert.equal(section(new URLSearchParams('smsPage=2&smsStatus=Unknown')),'sms');
  assert.equal(section(new URLSearchParams('section=shipping&smsTab=history')),'shipping');
  assert.equal(section(new URLSearchParams('section=invalid')),'identity');assert.equal(section(new URLSearchParams()),'identity');
});
