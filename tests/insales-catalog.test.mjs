import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInSalesDrafts } from '../commerce/insales-catalog.mjs';

const mapping={categories:{5:'belts'},manufacturers:{7:'Synthetic manufacturer'},units:{pce:'шт.'}};
const options={mapping,allowedCategories:['belts']};
const fixture=id=>({id,updated_at:'2026-10-01T00:00:00.000Z',category_id:5,title:'Synthetic part',unit:'pce',currency_code:'RUR',available:true,
  variants:[{id,product_id:id,sku:'TEST-ONLY-'+id,price:'10.01',quantity:1,available:true}]});
const mappedOptions=rows=>({...options,mapping:{...mapping,manufacturers:Object.fromEntries(rows.map(p=>[p.id,'Synthetic manufacturer']))}});
test('invalid merchant mappings fail before source requests',async()=>{
  let calls=0;const reader={async listProducts(){calls++;return [];}};
  for(const invalid of [null,[],{...mapping,units:null},{...mapping,manufacturers:{7:'x'.repeat(129)}},{...mapping,password:'PRIVATE'}]) {
    await assert.rejects(loadInSalesDrafts({...options,mapping:invalid,reader}),TypeError);
  }
  assert.equal(calls,0);
});
test('total source size is bounded across individually small pages',async()=>{
  let calls=0;const reader={async listProducts({fromId}){calls++;return Array.from({length:100},(_,i)=>({id:Number(fromId??0)+i+1,updated_at:'2026-10-01T00:00:00.000Z',private_note:'x'.repeat(32768)}));}};
  await assert.rejects(loadInSalesDrafts({...options,reader}),{code:'INSALES_CATALOG_TOO_LARGE'});assert.equal(calls,6);
});
test('pagination stops on the total source variant count even when every variant is invalid',async()=>{
  let calls=0;const reader={async listProducts({fromId}){calls++;return fromId===undefined?
    Array.from({length:100},(_,i)=>({id:i+1,updated_at:'2026-10-01T00:00:00.000Z',variants:Array.from({length:50},()=>({}))})):
    [{id:101,variants:[{}]}];}};
  await assert.rejects(loadInSalesDrafts({...options,reader}),{code:'INSALES_CATALOG_TOO_LARGE'});
  assert.equal(calls,2);
});
test('an aborted import cannot contact the provider or return drafts',async()=>{
  const controller=new AbortController();controller.abort();let fetched=false;
  await assert.rejects(loadInSalesDrafts({...options,signal:controller.signal,reader:{async listProducts(){fetched=true;return [];}}}),{code:'INSALES_TIMEOUT'});
  assert.equal(fetched,false);
});
test('the overall deadline is propagated to and cancels an active transport request',async()=>{
  const controller=new AbortController();const env={INSALES_SHOP_HOST:'synthetic-only.myinsales.ru',INSALES_API_KEY:'test-key',INSALES_API_PASSWORD:'test-secret'};
  await assert.rejects(loadInSalesDrafts({...options,env,signal:controller.signal,fetchImpl:async(_url,init)=>new Promise((_resolve,reject)=>{
    init.signal.addEventListener('abort',()=>reject(new Error('PRIVATE transport detail')),{once:true});controller.abort();
  })}),error=>error.code==='INSALES_TIMEOUT'&&!error.message.includes('PRIVATE'));
});
test('deleting an earlier product cannot shift the unread next product behind an offset page',async()=>{
  const source=Array.from({length:101},(_,i)=>fixture(i+1)), initial=[...source];let calls=0;
  const reader={async listProducts(query){
    assert.equal(query.page,1);assert.equal(query.perPage,100);assert.ok(query.updatedSince);calls++;
    if(calls===2)source.shift();
    return source.filter(p=>BigInt(p.id)>BigInt(query.fromId??0)).slice(0,100);
  }};
  const result=await loadInSalesDrafts({...mappedOptions(initial),reader});
  assert.equal(calls,3);assert.equal(result.ok,true);assert.equal(result.summary.drafts,101);
  assert.ok(result.catalog.products.some(p=>p.id==='insales-101'));
  assert.ok(result.catalog.products.every(p=>p.state==='draft'));assert.equal(result.checkoutEnabled,false);
});
test('bulk-update cursors preserve large string identities and continue until an empty response',async()=>{
  const rows=['9007199254740993','9007199254740994'].map(fixture);let calls=0;
  const reader={async listProducts(query){
    calls++;assert.equal(query.page,1);
    if(calls===1)return rows;
    assert.equal(query.fromId,rows[1].id);assert.equal(query.updatedSince,rows[1].updated_at);return [];
  }};
  const result=await loadInSalesDrafts({...mappedOptions(rows),reader});
  assert.equal(result.ok,true);assert.equal(result.summary.drafts,2);assert.equal(calls,2);
});
test('missing timestamps and non-progressing source order fail without returning partial drafts',async()=>{
  const missing=fixture(7);delete missing.updated_at;
  const invalid={...fixture(7),updated_at:'PRIVATE invalid date'};
  const backwards=[fixture(8),fixture(7)];
  for(const batch of [[missing],[invalid],backwards]) {
    await assert.rejects(loadInSalesDrafts({...options,reader:{async listProducts(){return batch;}}}),error=>error.code==='INSALES_RESPONSE_INVALID'&&!error.message.includes('PRIVATE'));
  }
  let calls=0;
  await assert.rejects(loadInSalesDrafts({...options,reader:{async listProducts(){calls++;return [fixture(7)];}}}),/Repeated product/);
  assert.equal(calls,2);
});
test('a provider returning endless short batches cannot be mistaken for a complete catalogue',async()=>{
  let calls=0;const reader={async listProducts(){calls++;return [fixture(calls)];}};
  await assert.rejects(loadInSalesDrafts({...options,reader}),{code:'INSALES_CATALOG_TOO_LARGE'});assert.equal(calls,51);
});
