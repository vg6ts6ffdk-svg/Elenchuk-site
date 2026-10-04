import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createStoreAdminRouter } from '../storefront/admin-api.mjs';

const env = { INSALES_SHOP_HOST:'synthetic-only.myinsales.ru',INSALES_API_KEY:'test-only-key',INSALES_API_PASSWORD:'test-only-secret' };
const mapping = { categories:{5:'belts'},manufacturers:{7:'Synthetic manufacturer'},units:{pce:'шт.'} };
const fixture = () => ({ id:7,category_id:5,title:'Synthetic test part',unit:'pce',currency_code:'RUB',available:true,
  cost_price:'PRIVATE-COST',description:'PRIVATE-NOTES',variants:[{id:11,product_id:7,sku:'TEST-ONLY-11',price:'100.01',quantity:2,available:true}] });
const json = data => new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
async function run(options,fn) {
  const app=express();
  const auth=(_req,res,next)=>options.authorized===false?res.status(401).json({error:'auth'}):next();
  app.use('/api/store-admin',createStoreAdminRouter({auth,enabled:()=>options.enabled!==false,env:options.env??env,fetchImpl:options.fetchImpl}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base='http://127.0.0.1:'+server.address().port+'/api/store-admin';
  try { await fn(base); } finally { await new Promise(resolve=>server.close(resolve)); }
}
const post=(base,path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});

test('provider routes require enabled storefront and admin authorization before any remote request',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return json([]);};
  for(const options of [{enabled:false},{authorized:false}]) await run({...options,fetchImpl},async base=>{
    for(const path of ['/insales/connection-check','/insales/import-preview']) assert.equal((await post(base,path,{mapping})).status,options.enabled===false?404:401);
  });
  assert.equal(calls,0);
});
test('configuration presence is not connection verification and a missing setup cannot enable checkout',()=>run({env:{},fetchImpl:async()=>{assert.fail('no provider request without credentials');}},async base=>{
  const status=await (await fetch(base+'/status')).json();assert.equal(status.provider.configured,false);assert.equal(status.provider.connected,undefined);
  const response=await post(base,'/insales/connection-check');assert.equal(response.status,503);
  const result=await response.json();assert.equal(result.code,'COMMERCE_BACKEND_DISABLED');assert.equal(result.checkoutEnabled,false);
}));
test('connection check uses one GET and returns access evidence without provider data or credentials',()=>run({fetchImpl:async(url,options)=>{
  assert.equal(url.pathname,'/admin/products.json');assert.equal(url.searchParams.get('per_page'),'1');assert.equal(options.method,'GET');return json([fixture()]);
}},async base=>{
  const response=await post(base,'/insales/connection-check');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();assert.equal(result.connected,true);assert.equal(result.catalogReadVerified,true);assert.equal(result.checkoutEnabled,false);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|TEST-ONLY|test-only|myinsales|Synthetic/);
}));
test('provider failures never masquerade as a connection and preserve the retry delay',async()=>{
  for(const status of [401,403,429,500]) await run({fetchImpl:async()=>new Response('PRIVATE test-only-secret',{status,headers:{'retry-after':'23'}})},async base=>{
    const response=await post(base,'/insales/connection-check');assert.equal(response.status,status===429?429:503);
    if(status===429) assert.equal(response.headers.get('retry-after'),'23');
    const result=await response.json();assert.equal(result.ok,false);assert.equal(result.connected,undefined);assert.equal(result.checkoutEnabled,false);
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE|test-only|myinsales/);
  });
});
test('empty or malformed provider responses are distinguished instead of accepting a login page',async()=>{
  for(const body of ['<html>PRIVATE login</html>',JSON.stringify([null])]) await run({fetchImpl:async()=>new Response(body,{headers:{'content-type':'application/json'}})},async base=>{
    const response=await post(base,'/insales/connection-check');assert.equal(response.status,502);assert.equal((await response.json()).code,'INSALES_RESPONSE_INVALID');
  });
  await run({fetchImpl:async()=>json([])},async base=>assert.equal((await (await post(base,'/insales/connection-check')).json()).connected,true));
});
test('admin preview produces drafts and excludes private source fields without authorizing publication',()=>run({fetchImpl:async()=>json([fixture()])},async base=>{
  const response=await post(base,'/insales/import-preview',{mapping});assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.summary.drafts,1);assert.equal(result.summary.published,0);assert.equal(result.preview[0].state,'draft');
  assert.equal(result.preview[0].priceMinor,10001);assert.equal(result.preview[0].stock,2);assert.equal(result.commitAllowed,false);assert.equal(result.checkoutEnabled,false);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|test-only-secret|myinsales|cost_price|description/);
  assert.equal((await post(base,'/publish')).status,404);assert.equal((await post(base,'/insales/publish')).status,404);
}));
test('bad mapping or browser-provided source settings are rejected before contacting inSales',async()=>{
  let calls=0;await run({fetchImpl:async()=>{calls++;return json([]);}},async base=>{
    for(const body of [{mapping:null},{mapping:{...mapping,manufacturers:[]}},{mapping:{...mapping,categories:{5:'fake-category'}}},{mapping,host:'untrusted.invalid'}]) {
      const response=await post(base,'/insales/import-preview',body);assert.equal(response.status,400);assert.equal((await response.json()).checkoutEnabled,false);
    }
  });assert.equal(calls,0);
});
test('invalid product rows never yield a partial preview',()=>run({fetchImpl:async()=>{const p=fixture();p.currency_code='USD';return json([p]);}},async base=>{
  const response=await post(base,'/insales/import-preview',{mapping});assert.equal(response.status,422);const result=await response.json();
  assert.equal(result.ok,false);assert.deepEqual(result.preview,[]);assert.equal(result.summary.drafts,0);assert.ok(result.errorsCount>0);assert.equal(result.commitAllowed,false);
}));
test('large valid imports report the full count while limiting the admin response to 100 rows',async()=>{
  const products=Array.from({length:101},(_,i)=>{const p=fixture();p.id=i+1;p.variants[0].id=i+1;p.variants[0].product_id=p.id;p.variants[0].sku='TEST-ONLY-'+p.id;return p;});
  const fullMapping={...mapping,manufacturers:Object.fromEntries(products.map(p=>[p.id,'Synthetic manufacturer']))};
  await run({fetchImpl:async url=>{const page=Number(url.searchParams.get('page'));return json(products.slice((page-1)*100,page*100));}},async base=>{
    const response=await post(base,'/insales/import-preview',{mapping:fullMapping});assert.equal(response.status,200);const result=await response.json();
    assert.equal(result.summary.drafts,101);assert.equal(result.preview.length,100);assert.equal(result.previewTruncated,true);assert.equal(result.commitAllowed,false);
  });
});
test('parallel loads share one active operation and failures release the guard',async()=>{
  let resolveStarted,release;const started=new Promise(resolve=>{resolveStarted=resolve;});let calls=0;
  await run({fetchImpl:async()=>{calls++;if(calls===1){resolveStarted();return new Promise(resolve=>{release=()=>resolve(new Response('PRIVATE failure',{status:500}));});}return json([]);}},async base=>{
    const first=post(base,'/insales/connection-check');await started;
    const blocked=await post(base,'/insales/import-preview',{mapping});assert.equal(blocked.status,429);assert.equal((await blocked.json()).code,'INSALES_BUSY');assert.equal(calls,1);
    release();assert.equal((await first).status,503);assert.equal((await post(base,'/insales/connection-check')).status,200);assert.equal(calls,2);
  });
});
test('a shared provider rate limit covers check and import requests without further upstream calls',async()=>{
  let calls=0;await run({fetchImpl:async()=>{calls++;return json([]);}},async base=>{
    for(let i=0;i<5;i++) assert.equal((await post(base,'/insales/connection-check')).status,200);
    const response=await post(base,'/insales/import-preview',{mapping});assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>0);
  });assert.equal(calls,5);
});
