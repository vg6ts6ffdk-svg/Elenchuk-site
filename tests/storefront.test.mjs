import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { storefrontEnabled, publicCatalog, categories } from '../storefront/settings.mjs';
import { renderStoreFiles, esc } from '../storefront/render.mjs';
import { cleanCart, readCart, writeCart, parseSearch, selectProducts, compatibility, formatPrice, serviceLink, validatePublicData } from '../store-core.js';
const product = (id='TEST') => ({id,sku:'TEST-SKU',name:'Тестовый компонент',category:'belts',manufacturer:'Test maker',unit:'шт.',state:'published',oem:['TEST-OEM'],priceMinor:12550,stock:3,availability:'in_stock',sourceRef:'private-test-reference',verifiedAt:'2026-09-20',compatibility:[{equipmentBrand:'TEST',model:'MODEL',status:'confirmed',sourceRef:'test-only'}]});
const published = products => publicCatalog({version:1,currency:'RUB',products});
const state = query => parseSearch(new URLSearchParams(query));
test('production cannot accidentally enable the preview with a local flag',()=>{
 assert.equal(storefrontEnabled({NODE_ENV:'production',ROSEEN_STOREFRONT_PREVIEW:'1'}),false);
 assert.equal(storefrontEnabled({VERCEL_ENV:'production',NODE_ENV:'production'}),false);
 assert.equal(storefrontEnabled({VERCEL_ENV:'preview',NODE_ENV:'production'}),true);
 assert.equal(storefrontEnabled({NODE_ENV:'test',ROSEEN_STOREFRONT_PREVIEW:'1'}),true);
});
test('repository catalogue contains no invented product offers',()=>{
 assert.deepEqual(publicCatalog().products,[]);
 const html=renderStoreFiles().get('shop.html');assert.match(html,/Каталог PUDU CC1/);assert.doesNotMatch(html,/TEST-SKU|0 ₽|data-add-cart/);
});
test('storefront exposes a safe PUDU CC1 quick filter without inventing products',()=>{
 const html=renderStoreFiles().get('shop.html');
 assert.match(html,/PUDU CC1/);assert.match(html,/equipmentBrand=PUDU&amp;model=CC1/);
});
test('public data is an explicit projection, not internal source records',()=>{
 const data=published([product()]);assert.doesNotMatch(JSON.stringify(data),/private-test-reference|sourceRef|verifiedAt/);validatePublicData(data);
});
test('categories and real product records get separate static URLs',()=>{
 const files=renderStoreFiles(published([product()]));assert.ok(files.has('product-TEST.html'));for(const c of categories)assert.ok(files.has(`shop-${c.id}.html`));assert.ok(files.has('account.html'));
 assert.match(files.get('product-TEST.html'),/noindex,nofollow/);assert.match(files.get('product-TEST.html'),/data-add-cart="TEST"/);
});
test('renderer escapes untrusted product text rather than injecting markup',()=>{
 const p=product();p.name='<img src=x onerror="alert(1)">';p.description='<script>alert(1)</script>';
 const html=renderStoreFiles(published([p])).get('product-TEST.html');assert.doesNotMatch(html,/<script>alert/);assert.match(html,/&lt;script&gt;/);assert.equal(esc('"<>&\''),'&quot;&lt;&gt;&amp;&#39;');
});
test('missing price or stock does not show an add-to-cart action',()=>{
 for(const [key,value] of [['priceMinor',null],['availability','unknown']]){const p=product();p[key]=value;const html=renderStoreFiles(published([p])).get('product-TEST.html');assert.doesNotMatch(html,/data-add-cart/);}
});
test('query normalization and decimal filters are bounded and explicit',()=>{
 const s=state('q=TEST&page=-2&min=12,34&max=20&sort=unsafe');assert.equal(s.page,1);assert.equal(s.min,1234);assert.equal(s.max,2000);assert.equal(s.sort,'name');assert.equal(state('min=-1').min,null);assert.equal(state('min=1e7').min,null);
});
test('search works for SKU, OEM and equipment model without invented matching',()=>{
 const products=published([product()]).products;for(const q of ['test-sku','test-oem','model'])assert.equal(selectProducts(products,state('q='+q)).total,1);assert.equal(selectProducts(products,state('q=nope')).total,0);
});
test('partial equipment information never implies confirmed compatibility',()=>{
 const ps=published([product()]).products;assert.equal(selectProducts(ps,state('equipmentBrand=TEST')).total,0);assert.equal(selectProducts(ps,state('equipmentBrand=TEST&model=MODEL')).total,1);
});
test('a revision exception prevents overbroad compatibility',()=>{
 const p=published([product()]).products[0];p.compatibility.push({equipmentBrand:'TEST',model:'MODEL',revision:'B',status:'incompatible'});assert.equal(compatibility(p,state('equipmentBrand=TEST&model=MODEL')),'unknown');assert.equal(compatibility(p,state('equipmentBrand=TEST&model=MODEL&revision=B')),'incompatible');
});
test('null prices are not free and remain last in either price sort',()=>{
 const a=product('A'),b=product('B');b.priceMinor=null;const ps=published([b,a]).products;for(const sort of ['price-asc','price-desc'])assert.equal(selectProducts(ps,state('sort='+sort)).products.at(-1).id,'B');assert.equal(selectProducts(ps,state('min=0')).total,1);assert.equal(formatPrice(null),'Цена по запросу');
});
test('pagination is deterministic and clamps impossible pages',()=>{
 const ps=published(Array.from({length:25},(_,i)=>({...product('T'+i),name:'TEST'+String(i).padStart(2,'0')}))).products;const r=selectProducts(ps,state('page=99'));assert.equal(r.page,3);assert.equal(r.products.length,1);assert.equal(r.total,25);
});
test('cart serializes only IDs and quantity, never PII or client prices',()=>{
 const value=cleanCart([{id:'TEST',quantity:2,contact:'must-not-persist',priceMinor:1},{id:'TEST',quantity:1},{id:'bad<id>',quantity:1}]);assert.deepEqual(value,[{id:'TEST',quantity:3}]);
 const storage={setItem(k,v){this.value=v;},getItem(){return this.value;}};assert.equal(writeCart(storage,value),true);assert.deepEqual(readCart(storage),value);assert.doesNotMatch(storage.value,/price|contact/);
});
test('malformed or denied storage is safely handled',()=>{
 const broken={getItem(){throw Error('Denied');},setItem(){throw Error('Quota');}};assert.deepEqual(readCart(broken),[]);assert.equal(writeCart(broken,[]),false);assert.deepEqual(cleanCart({items:[]}),[]);assert.deepEqual(readCart({getItem:()=>'{oops'}),[]);
});
test('service handoff keeps bounded plain text in an existing request form',()=>{
 const href=serviceLink({sku:'OEM<123>',equipment:'Test model',mode:'installation'});const url=new URL(href,'https://example.invalid/');assert.equal(url.pathname,'/contacts.html');assert.equal(url.hash,'#request');assert.equal(url.searchParams.get('serviceSku'),'OEM<123>');assert.equal(url.searchParams.get('requestMode'),'installation');
});
test('unsafe product URL or photo cannot enter browser-rendered content',()=>{
 const d=published([product()]);d.products[0].url='javascript:alert(1)';assert.throws(()=>validatePublicData(d));d.products[0].url='product-TEST.html';d.products[0].image='https://tracker.invalid/a.png';assert.throws(()=>validatePublicData(d));
});
test('active source templates no longer contain a typed logo surrogate',()=>{
 for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html')))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/class="brand-wordmark"/,file);
});
