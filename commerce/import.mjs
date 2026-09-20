import { validateCatalog } from './catalog.mjs';

const MAX_ROWS = 5000;
const text = x => typeof x === 'string' ? x.trim() : '';

export function normalizeImportRows(rows,{sourceRef=''}={}) {
  if(!Array.isArray(rows) || rows.length>MAX_ROWS) throw new TypeError('Invalid import row count');
  const errors=[]; const products=[]; const seen=new Set();
  rows.forEach((row,index)=>{
    const n=index+2;
    if(!row || typeof row!=='object') { errors.push({row:n,field:'row',message:'Строка не является объектом'}); return; }
    const id=text(row.id), sku=text(row.sku), name=text(row.name), category=text(row.category), manufacturer=text(row.manufacturer), unit=text(row.unit)||'шт.';
    if(!id) errors.push({row:n,field:'id',message:'Нужен ID'});
    if(!sku) errors.push({row:n,field:'sku',message:'Нужен SKU'});
    if(seen.has(sku)) errors.push({row:n,field:'sku',message:'Дубликат SKU в импорте'}); else if(sku) seen.add(sku);
    for(const [field,value] of Object.entries({name,category,manufacturer})) if(!value) errors.push({row:n,field,message:'Обязательное поле'});
    const priceRaw=text(row.priceMinor); const stockRaw=text(row.stock);
    const priceMinor=priceRaw===''?null:Number(priceRaw);
    const stock=stockRaw===''?null:Number(stockRaw);
    if(priceMinor!==null && (!Number.isSafeInteger(priceMinor)||priceMinor<=0)) errors.push({row:n,field:'priceMinor',message:'Цена — положительное целое число копеек'});
    if(stock!==null && (!Number.isSafeInteger(stock)||stock<0)) errors.push({row:n,field:'stock',message:'Остаток — целое число ≥ 0'});
    const availability=text(row.availability)||'unknown';
    const state='draft'; // imports never self-publish
    products.push({id,sku,name,category,manufacturer,unit,state,availability,priceMinor,stock,oem:text(row.oem).split(/[;,]/).map(x=>x.trim()).filter(Boolean),sourceRef:text(row.sourceRef)||sourceRef,verifiedAt:null,compatibility:[]});
  });
  if(errors.length) return {ok:false,errors,products:[]};
  const catalog={version:1,currency:'RUB',products};
  try { validateCatalog(catalog); } catch(e) { return {ok:false,errors:[{row:0,field:'catalog',message:e.message}],products:[]}; }
  return {ok:true,errors:[],products,summary:{rows:products.length,drafts:products.length,published:0}};
}

export function previewImport(rows,options={}) {
  const result=normalizeImportRows(rows,options);
  return {...result,commitAllowed:false,note:'Предпросмотр не публикует и не записывает товары'};
}
