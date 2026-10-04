import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFiles} from '../security.mjs';

function box(major,compatible=[],extended=false){
  const header=extended?16:8,bytes=Buffer.alloc(header+8+compatible.length*4);
  bytes.writeUInt32BE(extended?1:bytes.length,0);bytes.write('ftyp',4,'latin1');
  if(extended)bytes.writeBigUInt64BE(BigInt(bytes.length),8);
  bytes.write(major,header,'latin1');compatible.forEach((brand,index)=>bytes.write(brand,header+8+index*4,'latin1'));
  return bytes;
}
const check=(buffer,mimetype)=>validateFiles([{buffer,mimetype,size:buffer.length}]);
test('ISO-BMFF signatures require a complete bounded ftyp box and matching media brands',()=>{
  for(const [type,major,compatible] of [
    ['video/mp4','isom',['mp42']],['video/mp4','mp42',[]],['video/quicktime','qt  ',[]],
    ['image/heic','heic',['mif1']],['image/heif','mif1',[]]
  ])for(const extended of [false,true])assert.doesNotThrow(()=>check(box(major,compatible,extended),type));
  for(const [bytes,type] of [
    [Buffer.from('evilftyp'),'video/mp4'],[box('xxxx'),'video/mp4'],
    [box('heic',['mif1','isom']),'video/mp4'],[box('isom'),'image/heic'],
    [box('mif1'),'image/heic'],[box('isom'),'video/quicktime']
  ])assert.throws(()=>check(bytes,type),{status:400});
  const truncated=box('isom');truncated.writeUInt32BE(32,0);
  const unaligned=Buffer.concat([box('isom'),Buffer.from([0])]);unaligned.writeUInt32BE(unaligned.length,0);
  const oversized=box('isom',[],true);oversized.writeBigUInt64BE(4097n,8);
  for(const bytes of [truncated,unaligned,oversized])assert.throws(()=>check(bytes,'video/mp4'),{status:400});
});
