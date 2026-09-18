import path from 'node:path';
import fs from 'node:fs';

export const invalid = message => Object.assign(new Error(message), {status:400});
export function cleanFiles(files) {
  for (const file of files || []) if (file.path) { try { fs.unlinkSync(file.path); } catch { /* multer may already remove it */ } }
}
export function fields(body = {}) {
  const limits={equipment_type:120,model:200,problem:5000,contact:300};
  const output={};
  for (const [key,max] of Object.entries(limits)) {
    const raw=body[key] ?? '';
    if(typeof raw!=='string' || raw.trim().length>max || (key!=='model' && !raw.trim())) throw invalid('Проверьте поле: '+key);
    output[key]=raw.trim();
  }
  return output;
}
const extensions={
  'image/jpeg':['.jpg','.jpeg'],'image/png':['.png'],'image/webp':['.webp'],'image/gif':['.gif'],
  'image/heic':['.heic'],'image/heif':['.heif'],'video/mp4':['.mp4'],'video/quicktime':['.mov'],
  'video/webm':['.webm'],'application/pdf':['.pdf']
};
export function fileFilter(_req,file,callback) {
  callback(extensions[file.mimetype]?.includes(path.extname(file.originalname).toLowerCase()) ? null : invalid('Формат файла не поддерживается'), true);
}
export function validateFiles(files=[]) {
  if(files.reduce((n,f)=>n+f.size,0)>3*1024*1024) throw invalid('Общий размер вложений — не больше 3 МБ.');
  for(const f of files) {
    const bytes=f.buffer || fs.readFileSync(f.path);
    const hex=bytes.subarray(0,8).toString('hex'), ascii=bytes.subarray(0,64).toString('latin1');
    const type=f.mimetype;
    const valid= type==='image/png' ? hex==='89504e470d0a1a0a'
      : type==='image/jpeg' ? hex.startsWith('ffd8ff')
      : type==='image/gif' ? /^(GIF87a|GIF89a)/.test(ascii)
      : type==='image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8,12)==='WEBP'
      : type==='application/pdf' ? ascii.startsWith('%PDF-')
      : type==='video/webm' ? hex.startsWith('1a45dfa3') && ascii.includes('webm')
      : ['video/mp4','video/quicktime','image/heic','image/heif'].includes(type) && ascii.slice(4,8)==='ftyp';
    if(!valid) throw invalid('Содержимое файла не соответствует формату.');
  }
}
export function rateLimit(max,ms) {
  const buckets=new Map();
  const timer=setInterval(()=>{for(const [key,v] of buckets) if(v.until<Date.now()) buckets.delete(key);},60000);timer.unref();
  return (req,res,next)=>{
    let v=buckets.get(req.ip);
    if(!v || v.until<Date.now()) {v={n:0,until:Date.now()+ms};buckets.set(req.ip,v);}
    if(++v.n>max) return res.set('Retry-After',String(Math.ceil((v.until-Date.now())/1000))).status(429).json({error:'Слишком много запросов. Повторите позже.'});
    next();
  };
}
