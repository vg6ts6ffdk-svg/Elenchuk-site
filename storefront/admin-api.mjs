import { Router, text as textBody } from 'express';
import { previewImport } from '../commerce/import.mjs';
import { parseDelimited } from '../commerce/delimited.mjs';
import { storefrontEnabled } from './settings.mjs';
import { rateLimit } from '../security.mjs';

export function createStoreAdminRouter({ auth, enabled = storefrontEnabled } = {}) {
  if (typeof auth !== 'function') throw new TypeError('Admin auth middleware is required');
  const router = Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store'); if(!enabled()) return res.status(404).json({error:'Маршрут не найден'}); next();});
  router.use(auth);
  router.get('/status',(_req,res)=>res.json({mode:'preview',catalogWritable:false,checkoutEnabled:false}));
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
