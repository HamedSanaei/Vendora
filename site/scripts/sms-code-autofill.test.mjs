import assert from 'node:assert/strict';
import test from 'node:test';
import { createSmsCodeAutofill as storefront } from '../src/lib/auth/sms-code-autofill.ts';
import { createSmsCodeAutofill as admin } from '../../admin/src/features/admin/utils/sms-code-autofill.ts';

/** Supplies isolated browser capability doubles, never SMS, browser permissions or actual credentials. */
async function withBrowser(run) {
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const requests=[];
  Object.defineProperty(globalThis,'window',{configurable:true,value:{isSecureContext:true,OTPCredential:function(){}}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{credentials:{get(options){return new Promise((resolve,reject)=>requests.push({resolve,reject,options}));}}}});
  try { await run(requests); }
  finally { if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator; }
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
for(const [name,create] of [['storefront',storefront],['admin',admin]]) {
  test(`${name}: buffers early arrival, delivers once, aborts after delivery and never submits`,async()=>withBrowser(async requests=>{
    const receiver=create(),values=[];receiver.start();requests[0].resolve({code:'123456'});await flush();assert.deepEqual(values,[]);
    receiver.ready(code=>values.push(code));assert.deepEqual(values,['123456']);assert.equal(requests[0].options.signal.aborted,true);
    receiver.ready(code=>values.push(code));assert.equal(values.length,1);
  }));
  test(`${name}: cancels obsolete requests and ignores late results`,async()=>withBrowser(async requests=>{
    const receiver=create(),values=[];receiver.start();receiver.ready(code=>values.push(code));receiver.start();
    assert.equal(requests[0].options.signal.aborted,true);requests[0].resolve({code:'111111'});await flush();assert.deepEqual(values,[]);
    receiver.ready(code=>values.push(code));requests[1].resolve({code:'654321'});await flush();assert.deepEqual(values,['654321']);
    receiver.start();receiver.cancel();requests[2].resolve({code:'222222'});await flush();receiver.ready(code=>values.push(code));assert.equal(values.length,1);
  }));
  test(`${name}: unsupported, denied and malformed results preserve manual entry`,async()=>withBrowser(async requests=>{
    const receiver=create(),values=[];window.isSecureContext=false;receiver.start();assert.equal(requests.length,0);
    window.isSecureContext=true;receiver.start();receiver.ready(code=>values.push(code));requests[0].reject(new Error('Permission denied'));await flush();
    receiver.start();receiver.ready(code=>values.push(code));requests[1].resolve({code:'123456<script>'});await flush();assert.deepEqual(values,[]);receiver.cancel();
  }));
}
