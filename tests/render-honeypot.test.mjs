import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

test('live branch rejects spam without files or rows; empty and absent traps remain compatible', async () => {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roseen-render-test-'));
 const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
 const port=listener.address().port;await new Promise(r=>listener.close(r));
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_URL:'',STORAGE_SIGNER_URL:'',STORAGE_SIGNER_KEY:'',FRONTEND_ORIGIN:'',ROSEEN_DATA_DIR:directory,JWT_SECRET:'synthetic-qa-secret-only',ADMIN_EMAIL:'qa@example.test',ADMIN_PASSWORD:'synthetic-qa-password'},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('startup timeout')),20000);child.once('exit',()=>{clearTimeout(timeout);reject(Error('server exited'))});child.stdout.on('data',d=>{if(String(d).includes('listening on')){clearTimeout(timeout);resolve();}});});
  const form=(trap)=>{const f=new FormData();for(const [k,v] of Object.entries({equipment_type:'Электроника',model:'QA',problem:'Isolated test',contact:'qa@example.test'}))f.set(k,v);if(trap!==undefined)f.set('website',trap);f.append('files',new Blob(['%PDF-1.7\nsynthetic attachment'],{type:'application/pdf'}),'qa.pdf');return f;};
  const post=(f)=>fetch('http://127.0.0.1:'+port+'/api/requests',{method:'POST',body:f});
  const spam=await post(form('https://spam.example.test'));assert.equal(spam.status,400);assert.equal((await spam.json()).id,undefined);
  assert.deepEqual(fs.readdirSync(path.join(directory,'uploads')),[]);
  let db=new Database(path.join(directory,'roseen.db'),{readonly:true});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,0);db.close();
  for(const trap of ['',undefined]){const result=await post(form(trap));assert.equal(result.status,201);assert.ok(Number.isInteger((await result.json()).id));}
  db=new Database(path.join(directory,'roseen.db'),{readonly:true});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,2);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM files').get().n,2);db.close();
 } finally {if(child.exitCode===null){child.kill();await once(child,'exit');}fs.rmSync(directory,{recursive:true,force:true});}
});
