import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { publicCatalog } from '../storefront/settings.mjs';
import { renderStoreFiles } from '../storefront/render.mjs';
import { brandPage } from './brand-pages.mjs';
const dir=path.resolve('qa/platform');fs.mkdirSync(dir,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'roseen-platform-qa-'));
const report={checked:[],failures:[],interactions:[],sha:process.env.GITHUB_SHA||'local',realTransactions:false};
const child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'test',ROSEEN_STOREFRONT_PREVIEW:'1',VERCEL:'',PORT:'0',HOST:'127.0.0.1',DATABASE_URL:'',ROSEEN_DATA_DIR:temp,JWT_SECRET:'only-synthetic-platform-qa-secret-2026',ADMIN_EMAIL:'qa@example.invalid',ADMIN_PASSWORD:'only-synthetic-platform-qa-password'},stdio:['ignore','pipe','pipe']});
const origin=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('QA server start timeout')),30000);child.stdout.on('data',d=>{const m=String(d).match(/listening on (\d+)/);if(m){clearTimeout(timeout);resolve('http://127.0.0.1:'+m[1]);}});child.once('exit',c=>{clearTimeout(timeout);reject(Error('QA server exited '+c));});child.stderr.on('data',()=>{});});
const base=process.env.PLATFORM_QA_URL||origin;
const fixture = {version:1,currency:'RUB',products:Array.from({length:14},(_,i)=>({id:'TEST-'+i,sku:'TEST-SKU-'+i,name:'ТЕСТОВЫЙ ТОВАР '+String(i).padStart(2,'0'),category:'belts',manufacturer:'Test maker',unit:'шт.',state:'published',oem:['TEST-OEM-'+i],priceMinor:i===13?null:10001+i,stock:3,availability:'in_stock',sourceRef:'isolated-test-only',verifiedAt:'2026-09-20',compatibility:[{equipmentBrand:'Test',model:'Model',status:'confirmed',sourceRef:'isolated-test-only'}]}))};
const testData=publicCatalog(fixture);
let browser;
async function capture(engine,width,height,file){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Never create a service request while checking a real deployment.
 await page.route('**/api/requests',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"QA: no real request"}'}));
 try {
  const res=await page.goto(base+'/'+file,{waitUntil:'networkidle'});assert.equal(res.status(),200);
  await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,7000))]));await page.waitForTimeout(750);
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,header:document.querySelector('.brand img')?.getAttribute('src'),footer:document.querySelector('.footer-inner img')?.getAttribute('src'),inter:[...document.fonts].some(f=>f.family.replaceAll('"','')==='Inter'&&f.status==='loaded'),logoTransform:getComputedStyle(document.querySelector('.brand img')).transform}));
  assert.ok(metrics.scroll<=width+1,'horizontal overflow');assert.match(metrics.header,/rosin-wordmark/);assert.match(metrics.footer,/roseen-wordmark/);assert.equal(metrics.logoTransform,'none');assert.equal(metrics.inter,true,'Inter did not load');assert.deepEqual(errors,[]);
  assert.equal(await page.locator('.product-card').count(),0,'No fake product cards in real preview');
  await page.screenshot({path:path.join(dir,`${engine}-${width}x${height}-${file}.png`),fullPage:true});report.checked.push({engine,width,height,file,...metrics});
 } catch(e){report.failures.push({engine,width,height,file,error:e.message});await page.screenshot({path:path.join(dir,`FAIL-${engine}-${width}-${file}.png`),fullPage:true}).catch(()=>{});}
 await ctx.close();
}
try {
 browser=await chromium.launch();
 for(const [width,height] of [[320,900],[390,844],[768,1024],[1024,768],[1440,1000],[844,390]]) for(const file of ['shop.html','shop-belts.html','cart.html']) await capture('chromium',width,height,file);
 // First-entry brand motion is session-scoped and never alters the logo geometry.
 const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
 await p.goto(base+'/index.html');assert.equal(await p.locator('html').getAttribute('data-motion-entry'),'first');
 await p.goto(base+'/shop.html');assert.equal(await p.locator('html').getAttribute('data-motion-entry'),'static');
 await p.locator('#q').fill('TEST-OEM');await p.locator('.query-row button').click();assert.equal(new URL(p.url()).searchParams.get('q'),'TEST-OEM');await p.goBack();assert.equal(await p.locator('#q').inputValue(),'');report.interactions.push('URL query and browser Back; motion first entry and later navigation');
 // Isolated synthetic data is intercepted only in this test context, not a deployed file.
 await p.route('**/store-data.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(testData)}));
 const syntheticHtml=brandPage(renderStoreFiles(testData).get('product-TEST-0.html'),'product-TEST-0.html',{storefront:true});
 await p.route('**/product-TEST-0.html',r=>r.fulfill({contentType:'text/html',body:syntheticHtml}));
 await p.goto(base+'/shop.html');await p.waitForFunction(()=>document.querySelectorAll('.product-card').length===12);
 await p.locator('#q').fill('TEST-OEM-0');await p.locator('.query-row button').click();assert.equal(await p.locator('.product-card').count(),1);
 await p.locator('.product-card h3').click();await p.locator('[data-add-cart]').click();await p.waitForFunction(()=>document.querySelector('#product-status').textContent.includes('добавлен'));
 assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('roseen.cart.v1'))),[{id:'TEST-0',quantity:1}]);
 await p.route('**/api/store/quote',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({currency:'RUB',issues:[],goodsReady:true,subtotalMinor:10001,checkoutAuthorized:false,checkoutEnabled:false})}));
 await p.locator('#product-status a').click();await p.waitForFunction(()=>document.querySelector('#cart-quote-status').textContent.includes('проверена'));assert.equal(await p.locator('.cart-row').count(),1);assert.equal(await p.locator('button[type=submit]').count(),0);
 await p.unroute('**/api/store/quote');await p.route('**/api/store/quote',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated test"}'}));
 await p.locator('[data-cart-quantity]').fill('2');await p.locator('[data-cart-quantity]').dispatchEvent('change');await p.waitForFunction(()=>document.querySelector('#cart-quote-status').textContent.includes('недоступен'));assert.equal(await p.locator('#cart-subtotal').innerText(),'—');
 const second=await ctx.newPage();await second.goto(base+'/cart.html');await second.evaluate(()=>localStorage.setItem('roseen.cart.v1','[]'));await p.waitForFunction(()=>document.querySelectorAll('.cart-row').length===0);
 report.interactions.push('Synthetic SKU/OEM filter, product template, persistent cart IDs only, mock quote success/error, no checkout, cross-tab sync');
 await p.goto(base+'/contacts.html?requestMode=installation&serviceSku=TEST-OEM&equipment=TEST-MODEL#request');assert.match(await p.locator('#problem').inputValue(),/TEST-OEM/);assert.equal(await p.locator('#model').inputValue(),'TEST-MODEL');report.interactions.push('Service handoff prefills existing fields without sending');await ctx.close();
 const denied=await browser.newContext({viewport:{width:320,height:844}});await denied.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('Denied');}});Object.defineProperty(window,'localStorage',{get(){throw Error('Denied');}});window.IntersectionObserver=undefined;});const dp=await denied.newPage();await dp.goto(base+'/shop.html');assert.ok(await dp.locator('h1').isVisible());assert.equal(await dp.locator('html').getAttribute('data-motion-entry'),'static');assert.equal(await dp.evaluate(()=>getComputedStyle(document.querySelector('.brand img')).opacity),'1');await denied.close();report.interactions.push('Denied storage and absent IntersectionObserver keep content visible');
 const reduced=await browser.newContext({reducedMotion:'reduce'});const rp=await reduced.newPage();await rp.goto(base+'/shop.html');assert.equal(await rp.evaluate(()=>document.getAnimations().length),0);await reduced.close();
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const np=await nojs.newPage();await np.goto(base+'/shop.html');assert.ok(await np.locator('h1').isVisible());await np.locator('.menu').click();assert.ok(await np.locator('.mobile-nav a[href="shop.html"]').isVisible());await np.locator('.mobile-nav a[href="shop.html"]').click();await np.locator('a.store-category[href="shop-belts.html"]').click();assert.match(np.url(),/shop-belts.html/);await nojs.close();report.interactions.push('Reduced-motion and JS-off category navigation');
 await browser.close();browser=await webkit.launch();for(const file of ['shop.html','shop-belts.html','cart.html'])await capture('webkit',390,844,file);
} catch(e){report.failures.push({suite:'interactions',error:e.stack});}
finally {if(browser)await browser.close();child.kill();await once(child,'exit').catch(()=>{});fs.rmSync(temp,{recursive:true,force:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({layouts:report.checked.length,interactions:report.interactions,failures:report.failures},null,2));if(report.failures.length)process.exitCode=1;
