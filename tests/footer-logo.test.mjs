import test from 'node:test';
import assert from 'node:assert/strict';
import { brandPage } from '../scripts/brand-pages.mjs';
import { renderStoreFiles } from '../storefront/render.mjs';
test('small footer logo does not wait for lazy loading on long pages',()=>{
 const html=brandPage(renderStoreFiles().get('shop.html'),'shop.html',{storefront:true});
 const footer=html.match(/<footer\b[\s\S]*?<\/footer>/)[0];
 assert.match(footer,/loading="eager"/);assert.doesNotMatch(footer,/loading="lazy"/);
});
