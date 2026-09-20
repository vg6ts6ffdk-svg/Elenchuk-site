import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pages } from '../public-files.mjs';
import { brandPage } from '../scripts/brand-pages.mjs';

test('every public shell uses the Cyrillic header and English footer master', () => {
 let checked=0;
 for(const file of pages){
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  if(!source.includes('site-header'))continue;
  const html=brandPage(source,file);
  const header=html.match(/<header\b[\s\S]*?<\/header>/)?.[0]||'';
  const footer=html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0]||'';
  assert.match(header,/src="assets\/brand\/rosin-wordmark\.svg"/,file+' header');
  assert.match(footer,/src="assets\/brand\/roseen-wordmark\.svg"/,file+' footer');
  assert.doesNotMatch(header+footer,/<span class="brand-wordmark">|<text\b/,file+' typed logo');
  checked++;
 }
 assert.ok(checked>=15,'expected all current public pages');
});
test('approved vector geometry is locked, not silently regenerated',()=>{
 const expected={'roseen-wordmark.svg':'a23101c634b267035edbe70c86c6fcb793e54679','rosin-wordmark.svg':'9fe3c82fbede5e97154ba4edf30fbd4d216f2677'};
 for(const [name,hash] of Object.entries(expected)){
  const bytes=fs.readFileSync(new URL('../assets/brand/'+name,import.meta.url));
  const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(actual,hash,'Master change needs explicit new approval: '+name);
  assert.doesNotMatch(bytes.toString(),/<(?:text|image)\b/);
 }
});
