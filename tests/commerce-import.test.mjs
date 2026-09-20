import test from 'node:test';
import assert from 'node:assert/strict';
import { previewImport } from '../commerce/import.mjs';

const row=()=>({id:'part-1',sku:'SKU-1',name:'Тестовая деталь',category:'test',manufacturer:'Test',unit:'шт.',priceMinor:'12345',stock:'2',availability:'in_stock',oem:'OEM-1;OEM-2'});
test('import preview always creates drafts and never grants commit',()=>{
 const r=previewImport([row()],{sourceRef:'test-file'});
 assert.equal(r.ok,true); assert.equal(r.commitAllowed,false); assert.equal(r.products[0].state,'draft'); assert.equal(r.summary.published,0);
});
test('unknown price stays null rather than zero',()=>{const x=row();x.priceMinor='';const r=previewImport([x]);assert.equal(r.ok,true);assert.equal(r.products[0].priceMinor,null);});
test('duplicate SKU blocks the whole import preview',()=>{const a=row(),b=row();b.id='part-2';const r=previewImport([a,b]);assert.equal(r.ok,false);assert.equal(r.products.length,0);assert.match(r.errors[0].message,/Дубликат/);});
test('bad money or stock is rejected before catalogue use',()=>{for(const [field,value] of [['priceMinor','12.5'],['priceMinor','0'],['stock','-1']]){const x=row();x[field]=value;assert.equal(previewImport([x]).ok,false);}});
test('import cannot exceed the bounded batch size',()=>{assert.throws(()=>previewImport(Array.from({length:5001},()=>({}))),/row count/);});
