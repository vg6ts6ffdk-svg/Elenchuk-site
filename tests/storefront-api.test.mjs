import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createStoreRouter } from '../storefront/api.mjs';
const catalog = {version:1,currency:'RUB',products:[{id:'TEST',sku:'TEST-SKU',name:'Only synthetic fixture',category:'belts',manufacturer:'Test',unit:'шт.',state:'published',oem:[],priceMinor:10001,stock:2,availability:'in_stock',sourceRef:'test-only',verifiedAt:'2026-09-20',compatibility:[]}]};
async function run(enabled, fn) {
 const app=express(); app.use(express.json({limit:'32kb'}));app.use('/api/store',createStoreRouter({enabled:()=>enabled,load:()=>catalog}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(r=>server.close(r)); }
}
const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('store API is disabled without preview permission',()=>run(false,async base=>{assert.equal((await fetch(base+'/api/store/catalog')).status,404);assert.equal((await fetch(base+'/api/store/quote',post({lines:[]}))).status,404);}));
test('catalog API does not expose private source references',()=>run(true,async base=>{const r=await fetch(base+'/api/store/catalog');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.doesNotMatch(await r.text(),/sourceRef|test-only/);}));
test('quote ignores client prices and never authorizes checkout',()=>run(true,async base=>{const r=await fetch(base+'/api/store/quote',post({lines:[{id:'TEST',quantity:2,priceMinor:1}],checkoutEnabled:true}));const q=await r.json();assert.equal(q.subtotalMinor,20002);assert.equal(q.checkoutAuthorized,false);assert.equal(q.checkoutEnabled,false);}));
test('quote rejects invalid lines and unverified stock',()=>run(true,async base=>{assert.equal((await fetch(base+'/api/store/quote',post({lines:[{id:'TEST',quantity:-1}]}))).status,400);const q=await(await fetch(base+'/api/store/quote',post({lines:[{id:'TEST',quantity:3}]}))).json();assert.equal(q.subtotalMinor,null);assert.equal(q.goodsReady,false);}));
test('no order, checkout or payment endpoint is exposed by the preview',()=>run(true,async base=>{for(const path of ['checkout','orders','payments'])assert.equal((await fetch(base+'/api/store/'+path,post({}))).status,404);}));
