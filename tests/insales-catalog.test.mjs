import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInSalesDrafts } from '../commerce/insales-catalog.mjs';

const mapping={categories:{5:'belts'},manufacturers:{7:'Synthetic manufacturer'},units:{pce:'шт.'}};
const options={mapping,allowedCategories:['belts']};
test('invalid merchant mappings fail before source requests',async()=>{
  let calls=0;const reader={async listProducts(){calls++;return [];}};
  for(const invalid of [null,[],{...mapping,units:null},{...mapping,manufacturers:{7:'x'.repeat(129)}},{...mapping,password:'PRIVATE'}]) {
    await assert.rejects(loadInSalesDrafts({...options,mapping:invalid,reader}),TypeError);
  }
  assert.equal(calls,0);
});
test('total source size is bounded across individually small pages',async()=>{
  let calls=0;const reader={async listProducts({page}){calls++;return Array.from({length:100},(_,i)=>({id:(page-1)*100+i+1,private_note:'x'.repeat(32768)}));}};
  await assert.rejects(loadInSalesDrafts({...options,reader}),{code:'INSALES_CATALOG_TOO_LARGE'});assert.equal(calls,6);
});
test('pagination stops on the total source variant count even when every variant is invalid',async()=>{
  let calls=0;const reader={async listProducts({page}){calls++;return page===1?
    Array.from({length:100},(_,i)=>({id:i+1,variants:Array.from({length:50},()=>({}))})):
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
