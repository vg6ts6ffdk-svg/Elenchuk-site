import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCommerceAdapter, disabledCommerceAdapter } from '../commerce/adapter.mjs';

test('commerce adapter contract fails closed when methods are missing',()=>{
  assert.throws(()=>assertCommerceAdapter({}),/Missing commerce adapter method/);
});
test('disabled adapter never creates a fake order',async()=>{
  const a=assertCommerceAdapter(disabledCommerceAdapter());
  await assert.rejects(()=>a.createOrder({}),e=>e.code==='COMMERCE_BACKEND_DISABLED');
});
