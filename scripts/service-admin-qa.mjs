// Real browser -> built form/admin -> isolated API -> SQLite/private files.
// No production credentials, requests, customers or outbound notifications.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium,webkit,expect} from 'playwright/test';

const root=process.cwd(),publicRoot=path.join(root,'dist');
const legacyRoot=process.env.ROSEEN_LEGACY_QA_DIR;
if(!legacyRoot||!fs.existsSync(path.join(legacyRoot,'server.js')))throw Error('Provide the pinned isolated legacy API source');
const output=path.join(root,'qa/service');fs.mkdirSync(output,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=','base64');
const report={sha:process.env.GITHUB_SHA||'local',legacySource:process.env.ROSEEN_LEGACY_QA_SHA||'local',environment:'isolated SQLite and private files',productionWrites:0,flows:[],failures:[]};
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
let browser;

async function flow(engine,width,contract){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roseen-browser-service-'));
  let apiBase,child,context,posts=0,healthChecks=0,rejectNext=false,fileId,releaseRequest;
  const frontend=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname.startsWith('/api/')){
      if(req.method==='GET'&&pathname==='/api/health')healthChecks++;
      if(req.method==='POST'&&pathname==='/api/requests'){
        posts++;
        if(rejectNext){rejectNext=false;req.resume();res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"Isolated QA: save unavailable"}');return;}
      }
      const fileMatch=pathname.match(/^\/api\/files\/(\d+)$/);if(fileMatch)fileId=Number(fileMatch[1]);
      const upstream=http.request(apiBase+req.url,{method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});
      // Hold the save until the browser has exercised a second submit. A timed
      // delay can expire during WebKit scheduling, after success resets fields.
      if(req.method==='POST'&&pathname==='/api/requests')releaseRequest=()=>req.pipe(upstream);else req.pipe(upstream);
      return;
    }
    let file;
    try{file=path.resolve(publicRoot,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));}catch{res.writeHead(400);res.end();return;}
    if(!file.startsWith(publicRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>frontend.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+frontend.address().port;
  async function start(){
    const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
    apiBase='http://127.0.0.1:'+port;
    child=spawn(process.execPath,['server.js'],{cwd:contract==='bearer'?legacyRoot:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',DATABASE_URL:'',VERCEL:'',STORAGE_SIGNER_URL:'',STORAGE_SIGNER_KEY:'',FRONTEND_ORIGIN:base,ROSEEN_DATA_DIR:directory,JWT_SECRET:'synthetic-browser-qa-secret-only',ADMIN_EMAIL:'qa@example.test',ADMIN_PASSWORD:'synthetic-browser-password',ROSEEN_STOREFRONT_PUBLIC:'0'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('isolated API startup timeout')),30000);
      child.once('exit',code=>{clearTimeout(timeout);reject(Error('isolated API exited: '+code));});
      child.stdout.on('data',data=>{if(String(data).includes('listening on')){clearTimeout(timeout);resolve();}});
      child.stderr.on('data',data=>process.stderr.write(data));
    });
  }
  async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit');}}
  try{
    await start();
    context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',route=>{
      const address=new URL(route.request().url());
      if(address.origin===base||address.protocol==='blob:')return route.continue();
      errors.push('Unexpected outbound browser request: '+address.origin);return route.abort();
    });
    const anonymous=await browser.newContext();
    assert.equal((await anonymous.request.get(base+'/api/requests')).status(),401);
    assert.equal((await anonymous.request.get(base+'/api/files/1')).status(),401);
    await anonymous.close();
    await page.goto(base+'/contacts.html#request');
    const form=page.locator('#request-form'),submit=form.locator('[type=submit]'),status=form.locator('.form-status');
    async function submitWhilePending(expectedPosts){
      await submit.click();await expect(submit).toBeDisabled();
      await expect.poll(()=>typeof releaseRequest).toBe('function');
      // Simulate a delayed client without allowing the fixture to finish saving.
      await page.waitForTimeout(400);await form.dispatchEvent('submit');
      assert.equal(posts,expectedPosts,'duplicate submit must not reach the API');
      const release=releaseRequest;releaseRequest=undefined;release();
      await expect(status).toHaveClass(/is-success/);
    }
    await page.locator('#equipment_type').selectOption({label:'Электроника'});
    await page.locator('#problem').fill('Synthetic QA without file');await page.locator('#contact').fill('qa@example.test');
    await submitWhilePending(1);await expect(status).toContainText('Заявка №');assert.equal(posts,1);
    await page.locator('#equipment_type').selectOption({label:'Электроника'});
    await page.locator('#problem').fill('Synthetic QA with file');await page.locator('#contact').fill('qa@example.test');
    await page.locator('.form-options summary').click();
    await page.locator('[name=files]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});
    rejectNext=true;await submit.click();await expect(status).toHaveClass(/is-error/);
    assert.equal(await page.locator('#problem').inputValue(),'Synthetic QA with file');assert.equal(await page.locator('[name=files]').evaluate(input=>input.files.length),1);
    await submitWhilePending(3);assert.equal(posts,3);assert.equal(healthChecks,1);
    await page.goto(base+'/admin.html');await expect(page.locator('#login-panel')).toBeVisible();
    async function login(){await page.locator('#email').fill('qa@example.test');await page.locator('#password').fill('synthetic-browser-password');await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.locator('.request-card')).toHaveCount(2);}
    await login();await page.locator('.request-card').filter({hasText:'Synthetic QA with file'}).click();
    await expect(page.locator('#detail')).toBeVisible();await expect(page.locator('#detail')).toContainText('synthetic.png');
    await page.locator('#request-status').selectOption('ready');await page.locator('#request-comment').fill('Synthetic QA completed');await page.getByRole('button',{name:'Сохранить',exact:true}).click();
    await expect(page.locator('#notice')).toContainText('обновлена');await expect(page.locator('#request-status')).toHaveValue('ready');
    async function download(){const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Скачать',exact:true}).click()]);assert.deepEqual(fs.readFileSync(await file.path()),png);}
    await download();
    await stop();await start();await page.getByRole('button',{name:'Обновить список',exact:true}).click();await expect(page.locator('.request-card')).toHaveCount(2);
    await page.locator('.request-card').filter({hasText:'Synthetic QA with file'}).click();await expect(page.locator('#request-status')).toHaveValue('ready');await download();
    if(engine==='chromium'&&width===390)await page.screenshot({path:path.join(output,contract+'-admin-390.png'),fullPage:true});
    await page.reload();
    if(contract==='bearer'){await expect(page.locator('#login-panel')).toBeVisible();await expect(page.locator('#app')).toBeHidden();await login();}
    else await expect(page.locator('.request-card')).toHaveCount(2);
    assert.equal(await page.evaluate(()=>localStorage.getItem('roseen_token')),null);
    await page.getByRole('button',{name:'Выйти',exact:true}).click();await expect(page.locator('#login-panel')).toBeVisible();await expect(page.locator('#app')).toBeHidden();
    assert.equal((await context.request.get(base+'/api/requests')).status(),401);assert.equal((await context.request.get(base+'/api/files/'+fileId)).status(),401);
    assert.deepEqual(errors,[]);
    report.flows.push({engine,width,contract,savedRequests:2,duplicatePosts:0,oneHealthWarmup:true,errorPreservesFieldsAndFile:true,statusAndFileSurviveRestart:true,byteExactDownload:true,logoutAndAnonymousDenied:true});
  }finally{if(context)await context.close();await stop();await new Promise(resolve=>frontend.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
}

try{
  for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
    browser=await driver.launch();
    for(const contract of ['cookie','bearer'])for(const width of [390,1440])await flow(engine,width,contract);
    await browser.close();browser=null;
  }
}catch(error){report.failures.push(error.stack);process.exitCode=1;}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
