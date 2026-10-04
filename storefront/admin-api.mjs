import { Router, text as textBody, json as jsonBody } from 'express';
import { previewImport } from '../commerce/import.mjs';
import { parseDelimited } from '../commerce/delimited.mjs';
import { storefrontEnabled, categories } from './settings.mjs';
import { rateLimit } from '../security.mjs';
import { inSalesStatus, InSalesError } from '../commerce/insales.mjs';
import { checkInSalesConnection, loadInSalesDrafts } from '../commerce/insales-catalog.mjs';

export function createStoreAdminRouter({ auth, enabled = storefrontEnabled, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (typeof auth !== 'function') throw new TypeError('Admin auth middleware is required');
  const router = Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store'); if(!enabled()) return res.status(404).json({error:'Маршрут не найден'}); next();});
  router.use(auth);
  router.get('/status',(_req,res)=>res.json({mode:'preview',catalogWritable:false,checkoutEnabled:false,provider:inSalesStatus(env)}));
  let inSalesBusy = false;
  async function inSalesOperation(res, operation) {
    if (inSalesBusy) return res.set('Retry-After','5').status(429).json({ok:false,code:'INSALES_BUSY',error:'Загрузка каталога уже выполняется.',checkoutEnabled:false});
    inSalesBusy = true;
    try { await operation(); }
    catch (error) {
      if (error instanceof InSalesError) {
        const status = error.code === 'INSALES_RATE_LIMIT' ? 429 : error.code === 'INSALES_RESPONSE_INVALID' ? 502 : 503;
        if (status === 429 && error.retryAfter !== null) res.set('Retry-After',String(error.retryAfter));
        res.status(status).json({ok:false,code:error.code,error:error.message,checkoutEnabled:false});
      } else if (error instanceof TypeError) {
        res.status(400).json({ok:false,code:'INSALES_IMPORT_INVALID',error:error.message,checkoutEnabled:false});
      } else {
        res.status(503).json({ok:false,code:'INSALES_UNAVAILABLE',error:'Загрузка каталога не завершена. Повторите позже.',checkoutEnabled:false});
      }
    } finally { inSalesBusy = false; }
  }
  const providerLimit = rateLimit(5,300000);
  router.post('/insales/connection-check',providerLimit,(_req,res)=>inSalesOperation(res,async()=>{
    res.json({ok:true,...await checkInSalesConnection({env,fetchImpl})});
  }));
  router.post('/insales/import-preview',providerLimit,jsonBody({limit:'32kb'}),(req,res)=>inSalesOperation(res,async()=>{
    const body=req.body;
    if (!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>key!=='mapping')) throw new TypeError('Передайте только словари соответствий в поле mapping.');
    const result=await loadInSalesDrafts({mapping:body.mapping,allowedCategories:categories.map(c=>c.id),env,fetchImpl});
    const products=result.catalog?.products??[];
    res.status(result.ok?200:422).json({ok:result.ok,summary:result.summary,errors:result.errors.slice(0,100),errorsCount:result.errors.length,
      errorsTruncated:result.errors.length>100,previewTruncated:products.length>100,
      preview:products.slice(0,100).map(p=>({id:p.id,sku:p.sku,name:p.name,category:p.category,manufacturer:p.manufacturer,unit:p.unit,state:p.state,
        priceMinor:p.priceMinor,stock:p.stock,availability:p.availability})),commitAllowed:false,checkoutEnabled:false});
  }));
  router.post('/import-preview',rateLimit(20,60000),textBody({type:['text/csv','text/plain'],limit:'2mb'}),(req,res)=>{
    try {
      const rows=parseDelimited(req.body||'');
      const result=previewImport(rows,{sourceRef:'admin-dry-run'});
      res.status(result.ok?200:422).json({ok:result.ok,summary:result.summary||null,errors:result.errors,preview:result.ok?result.products.slice(0,100).map(p=>({id:p.id,sku:p.sku,name:p.name,category:p.category,manufacturer:p.manufacturer,state:p.state,priceMinor:p.priceMinor,stock:p.stock,availability:p.availability})):[],commitAllowed:false});
    } catch(e) {
      if(e instanceof TypeError) return res.status(400).json({ok:false,errors:[{row:0,field:'file',message:e.message}],preview:[],commitAllowed:false});
      throw e;
    }
  });
  router.use((_req,res)=>res.status(404).json({error:'Запись каталога и публикация в этой версии закрыты'}));
  return router;
}
