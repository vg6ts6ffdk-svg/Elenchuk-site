import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium, webkit } from 'playwright';
const require=createRequire(import.meta.url);
const root=path.resolve('dist'),output=path.resolve('qa/seo-a11y');fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname, file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const report={sha:process.env.GITHUB_SHA||'local',checks:[],failures:[],realRequests:false};
let browser;
try {
 for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]) {
  browser=await driver.launch();
  for(const width of [390,1440]) {
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
   for(const file of ['index.html','services.html','directions.html','about.html','faq.html','contacts.html','news.html','briefing-2026-09-28.html','shop.html','cart.html','account.html','404.html']) {
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/requests',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Isolated QA only"}'}));
    await page.goto(base+'/'+file);await page.evaluate(()=>document.fonts.ready);
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const result=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
    const violations=result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
    report.checks.push({engine,width,file,violations});
    if(violations.length)report.failures.push({engine,width,file,violations});
    assert.equal(errors.length,0,file+' runtime errors');
    const state=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,background:getComputedStyle(document.body).backgroundColor,nav:document.querySelectorAll('.nav > a').length,broken:[...document.images].filter(i=>i.loading!=='lazy'&&(!i.complete||!i.naturalWidth)).map(i=>i.src)}));
    assert.ok(state.scroll<=state.width+1,file+' horizontal overflow');assert.equal(state.nav,5);assert.equal(state.background,'rgb(22, 24, 29)');assert.deepEqual(state.broken,[]);
    if(width===390) {
     await page.locator('.menu').click();await page.locator('.mobile-nav > a').first().focus();await page.keyboard.press('Escape');
     assert.equal(await page.locator('.menu-wrap').getAttribute('open'),null);assert.equal(await page.locator('.menu').evaluate(el=>el===document.activeElement),true);
    }
    if(engine==='chromium'&&width===390&&['index.html','contacts.html'].includes(file)) await page.screenshot({path:path.join(output,file.replace('.html','')+'-390.png'),fullPage:true});
   }
   await page.goto(base+'/contacts.html#request');
   await page.evaluate(()=>{window.qaGoals=[];window.ROSEEN_TRACK=(...args)=>window.qaGoals.push(args)});
   let response={status:503,body:{error:'Isolated QA: failed save'}};
   await page.unroute('**/api/requests');await page.route('**/api/requests',r=>r.fulfill({status:response.status,contentType:'application/json',body:JSON.stringify(response.body)}));
   await page.locator('#equipment_type').selectOption({label:'Электроника'});await page.locator('#problem').fill('Isolated test only');await page.locator('#contact').fill('qa@example.test');
   await page.locator('#request-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('.form-status').classList.contains('is-error'));
   assert.equal(await page.evaluate(()=>window.qaGoals.length),0);assert.equal(await page.locator('#problem').inputValue(),'Isolated test only');
   response={status:201,body:{id:99001}};await page.locator('#request-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('.form-status').classList.contains('is-success'));
   assert.equal(await page.evaluate(()=>window.qaGoals.length),1);assert.equal(await page.locator('#problem').inputValue(),'');
   assert.equal(await page.locator('#website').getAttribute('tabindex'),'-1');
   const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base+'/index.html');
   assert.ok(!requests.some(u=>u.includes('store.min.js')||u.includes('store-data.json')||u.includes('mc.yandex')||u.includes('googletagmanager')));
   await context.close();
  }
  const native=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});
  let nativeBody='';
  await native.route('**/api/requests',r=>{nativeBody=r.request().postData()||'';return r.fulfill({status:201,contentType:'application/json',body:'{"id":99002}'})});
  const nativePage=await native.newPage();await nativePage.goto(base+'/contacts.html#request');
  await nativePage.locator('#equipment_type').selectOption({label:'Электроника'});await nativePage.locator('#problem').fill('Native isolated QA');await nativePage.locator('#contact').fill('qa@example.test');
  await Promise.all([nativePage.waitForURL('https://api.roseen.ru/api/requests'),nativePage.locator('#request-form [type=submit]').click()]);
  assert.match(nativeBody,/Native isolated QA/);assert.match(nativeBody,/name="website"/);assert.doesNotMatch(nativeBody,/name="video_link"/);
  assert.equal((nativeBody.match(/Content-Disposition: form-data; name="(?!files")/gi)||[]).length,5);
  report.checks.push({engine,file:'contacts.html',javaScript:false,nativeFields:5,realRequests:false});
  await native.close();await browser.close();browser=null;
 }
} catch(error) {report.failures.push(error.stack);process.exitCode=1;}
finally {if(browser)await browser.close();server.close();if(report.failures.length)process.exitCode=1;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failures:report.failures,realRequests:false},null,2));
