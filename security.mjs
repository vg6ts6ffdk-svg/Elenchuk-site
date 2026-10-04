import path from 'node:path';
import fs from 'node:fs';

export const invalid = message => Object.assign(new Error(message), {status:400});
export function cleanFiles(files) {
  for (const file of files || []) if (file.path) { try { fs.unlinkSync(file.path); } catch { /* multer may already remove it */ } }
}
export function fields(body = {}) {
  if(body.website != null && (typeof body.website !== 'string' || body.website.trim())) throw invalid('Не удалось проверить форму. Обновите страницу и повторите.');
  const limits={equipment_type:120,model:200,problem:5000,contact:300};
  const aliases={category:120,symptom:5000};
  for(const key of Object.keys(body)) {
    if(!Object.hasOwn(limits,key)&&!Object.hasOwn(aliases,key)&&key!=='website') throw invalid('Неизвестное поле формы.');
    if(Object.hasOwn(aliases,key)&&(typeof body[key]!=='string'||body[key].length>aliases[key])) throw invalid('Проверьте поле: '+key);
  }
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
// Registered brands are useful signatures, not an exhaustive video registry.
// Unknown/future BMFF brands can prove their type with a bounded movie track.
function hasVideoTrack(bytes,start) {
  const children={moov:'trak',trak:'mdia',mdia:'hdlr'};
  function scan(from,end,parent){
    for(let at=from;at+8<=end;){
      let size=bytes.readUInt32BE(at),header=8;
      if(size===1){if(at+16>end)return false;const large=bytes.readBigUInt64BE(at+8);if(large>BigInt(end-at))return false;size=Number(large);header=16;}
      else if(size===0)size=end-at;
      if(size<header||at+size>end)return false;
      const kind=bytes.toString('latin1',at+4,at+8),payload=at+header;
      if(parent==='mdia'&&kind==='hdlr'&&size>=header+24&&bytes.toString('latin1',payload+8,payload+12)==='vide')return true;
      if(kind===(parent?children[parent]:'moov')&&scan(payload,at+size,kind))return true;
      at+=size;
    }
    return false;
  }
  return scan(start,bytes.length,'');
}
function bmffSignature(bytes,type) {
  if(bytes.length<16||bytes.toString('latin1',4,8)!=='ftyp')return false;
  let size=bytes.readUInt32BE(0),header=8;
  if(size===1){if(bytes.length<24)return false;const large=bytes.readBigUInt64BE(8);if(large>4096n)return false;size=Number(large);header=16;}
  if(size<header+8||size>bytes.length||size>4096||(size-header-8)%4!==0)return false;
  const brands=[bytes.toString('latin1',header,header+4)];
  for(let at=header+8;at<size;at+=4)brands.push(bytes.toString('latin1',at,at+4));
  const heic=['heic','heix','hevc','hevx','heim','heis','hevm','hevs'];
  const images=['mif1','mif2','msf1',...heic,'avif','avis','avio','avci','avcs','jpeg','jpgs','j2ki','j2is','jxsi','jxss'];
  if(type==='image/heic')return brands.some(brand=>heic.includes(brand));
  if(type==='image/heif')return brands.some(brand=>['mif1','mif2','msf1',...heic].includes(brand));
  if(type==='video/mp4'||type==='video/quicktime')return !brands.some(brand=>images.includes(brand))&&hasVideoTrack(bytes,size);
  return false;
}
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
      : bmffSignature(bytes,type);
    if(!valid) throw invalid('Содержимое файла не соответствует формату.');
  }
}
