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
    ['video/mp4','isom',['mp42']],['video/mp4','mp42',[]],['video/mp4','mp71',[]],['video/mp4','MSNV',[]],['video/mp4','isoa',[]],['video/quicktime','qt  ',[]],
    ['image/heic','heic',['mif1']],['image/heif','mif1',[]]
  ])for(const extended of [false,true])assert.doesNotThrow(()=>check(Buffer.concat([box(major,compatible,extended),...(type.startsWith('video/')?[movie('vide')]:[])]),type));
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

function container(kind,payload){const bytes=Buffer.alloc(8+payload.length);bytes.writeUInt32BE(bytes.length,0);bytes.write(kind,4,'latin1');payload.copy(bytes,8);return bytes;}
function movie(handler){const payload=Buffer.alloc(24);payload.write(handler,8,'latin1');return container('moov',container('trak',container('mdia',container('hdlr',payload))));}
test('unknown/future BMFF brands use a bounded video track instead of an exhaustive brand allowlist',()=>{
  const video=Buffer.concat([box('new1'),movie('vide')]);
  assert.doesNotThrow(()=>check(video,'video/mp4'));assert.doesNotThrow(()=>check(video,'video/quicktime'));
  for(const bytes of [Buffer.concat([box('new1'),movie('soun')]),Buffer.concat([box('avif',['isom']),movie('vide')])])assert.throws(()=>check(bytes,'video/mp4'),{status:400});
  const oversized=Buffer.concat([box('new1'),movie('vide')]);oversized.writeUInt32BE(0xffffffff,16);
  assert.throws(()=>check(oversized,'video/mp4'),{status:400});
  const zeroLength=Buffer.concat([box('new1'),Buffer.alloc(8)]);zeroLength.writeUInt32BE(4,16);
  assert.throws(()=>check(zeroLength,'video/mp4'),{status:400});
});

test('generic and metadata brands cannot short-circuit movie handler validation',()=>{
  for(const brand of ['isom','mp71','isoa','isob','isoc','MSNV','mp41','mp42','qt  '])for(const type of ['video/mp4','video/quicktime']){
    assert.throws(()=>check(box(brand),type),{status:400});
    assert.throws(()=>check(Buffer.concat([box(brand),movie('soun')]),type),{status:400});
    assert.doesNotThrow(()=>check(Buffer.concat([box(brand),movie('vide')]),type));
  }
});
