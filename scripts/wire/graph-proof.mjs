// Explicit CI integration proof; no live server, browser or benchmark timing.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sealGraphPart,openGraphPart} from '../../packages/wire/lib/bench/capture/graph-part.js';
import {deflateSync} from 'node:zlib';
import {Dictionary,expand} from '../../packages/wire/lib/bench/capture/capture-graph.js';
import {archiveGraphSession,readGraphSession} from '../../packages/wire/lib/bench/capture/session-graph.js';
import {readSessionArchive} from '../../packages/wire/lib/bench/capture/session-archive.js';
import {packFrameWords} from '../../packages/wire/lib/bench/capture/frame-words.js';
import {preparePacket} from '../../packages/wire/lib/bench/capture/packet-replay.js';
const bytes=value=>Buffer.from(JSON.stringify(value)+'\n');
const digest=data=>createHash('sha256').update(data).digest('hex');
function check(name,work){void test(name,{timeout:9500},async()=>{const start=performance.now();await work();assert.ok(performance.now()-start<9500,'Graph proof exceeds 9.5 seconds');});}
const walk=new URL('../../packages/wire/bench/recordings/walking/',import.meta.url);
const original=await readSessionArchive(JSON.parse(readFileSync(new URL('manifest.json',walk))),async file=>readFileSync(new URL(file,walk)));
const fixture={version:1,engine:original.engine,product:original.product,ticks:1,frames:packFrameWords([original.frames[0]]),packets:original.packets.filter(packet=>packet.tick===0)};
const small=await archiveGraphSession(fixture);
const load=async file=>{const data=small.files.get(file);assert.ok(data);return data;};
// Test-only hostile writer deliberately omits the production frozen oracle.
async function hostile(source){const dictionary=new Dictionary(),root=dictionary.put(source),data=await sealGraphPart(bytes(dictionary.nodes));assert.ok(data.length<1000000);const manifest={...small.manifest,root,nodes:dictionary.nodes.length,expandedBytes:bytes(source).length,hash:digest(bytes(source)),parts:[{file:'part-000.json',start:0,count:dictionary.nodes.length,bytes:data.length,expandedBytes:bytes(dictionary.nodes).length,hash:digest(data)}]};return {manifest,read:async()=>data};}
check('graph storage reconstructs a real complete stream before returning it',async()=>{
 const session=await readGraphSession(small.manifest,load);
 assert.deepEqual(session.frames,[original.frames[0]]);assert.deepEqual(session.packets,fixture.packets);
});
check('missing, reordered and redirected graph parts refuse before reads',async()=>{
 let reads=0;const read=async()=>{reads++;throw new Error('read reached');};
 await assert.rejects(readGraphSession({...small.manifest,parts:[]},read));
 await assert.rejects(readGraphSession({...small.manifest,parts:[{...small.manifest.parts[0],file:'../escape.json'}]},read));
 await assert.rejects(readGraphSession({...small.manifest,parts:[{...small.manifest.parts[0],start:1}]},read));
 assert.equal(reads,0);
});
check('hash-valid graph nodes cannot cycle, duplicate keys or expand without bounds',async()=>{
 assert.throws(()=>expand([[1,[0]]],0),/forward or missing/);
 assert.throws(()=>expand([[0,'x'],[0,1],[2,[[0,1],[0,1]]]],2),/repeated object key/);
 const bomb=[[0,'x']];for(let i=1;i<30;i++)bomb.push([1,[i-1,i-1]]);
 assert.throws(()=>expand(bomb,bomb.length-1),/expansion budget/);
 const depth=[[0,'x']];for(let i=1;i<70;i++)depth.push([1,[i-1]]);
 assert.throws(()=>expand(depth,depth.length-1),/expansion budget/);
 const bad={...small.manifest,hash:'0'.repeat(64)};await assert.rejects(readGraphSession(bad,load),/expanded content differs/);
});
check('part decompression is bounded before graph parsing',async()=>{
 const bomb=bytes({codec:'deflate-json/1',expandedBytes:1000000,data:deflateSync(Buffer.alloc(1000001,32)).toString('base64')});
 await assert.rejects(openGraphPart(bomb),/decompression budget/);
 const wrong=bytes({codec:'deflate-json/1',expandedBytes:1,data:deflateSync(Buffer.from('[]')).toString('base64')});
 await assert.rejects(openGraphPart(wrong),/decompressed length differs|decompression budget/);
});
check('all graph admission precedes output object construction',async()=>{
 const original=Object.defineProperty;let writes=0;
 try{
  Object.defineProperty=(object,key,descriptor)=>{if(key==='sentinel')writes++;return original(object,key,descriptor);};
  assert.throws(()=>expand([[0,'sentinel'],[0,true],[2,[[0,1]]],[1,[99]]],3),/forward or missing/);
  assert.equal(writes,0);
 }finally{Object.defineProperty=original;}
});
check('changed graph bytes and wrong metadata refuse',async()=>{
 await assert.rejects(readGraphSession(small.manifest,async file=>{const data=Uint8Array.from(await load(file));data[0]^=1;return data;}),/part bytes differ/);
 await assert.rejects(readGraphSession({...small.manifest,product:'foreign'},load),/metadata differs/);
});
check('correctly resealed frame and valid-prefix packet corruption still refuse frozen replay',async()=>{
 const frame=structuredClone(fixture),raw=Buffer.from(frame.frames.frames[0].bytes,'base64');raw[raw.length-1]^=1;frame.frames.frames[0].bytes=raw.toString('base64');
 const a=await hostile(frame);await assert.rejects(readGraphSession(a.manifest,a.read),/Frozen v0 frame replay differs/);
 const packet=structuredClone(fixture),row=packet.packets.find(row=>'packet'in row&&Buffer.from(row.packet.bytes,'base64')[0]===6);assert.ok(row);
 const data=Buffer.from(row.packet.bytes,'base64');data[data.length-1]^=1;row.packet.bytes=data.toString('base64');
 const b=await hostile(packet);await assert.rejects(readGraphSession(b.manifest,b.read),/Frozen v0 packet replay differs/);
 await assert.rejects(archiveGraphSession(packet),/Frozen v0 packet replay differs/);
});
check('all 32 clients retain the complete moving 60-creature dense stream',async()=>{
 const directory=new URL('../../packages/wire/bench/recordings/dense/',import.meta.url),header=JSON.parse(readFileSync(new URL('manifest.json',directory)));
 const session=await readGraphSession(header,async file=>readFileSync(new URL(file,directory)));
 assert.equal(session.product,'synthetic-dense-32-60');assert.equal(session.ticks,180);
 assert.equal(session.frames.length,2912);assert.equal(session.packets.length,8768);
 const owners=[],handles=[];let commands=0,lost=0;const lostTicks=new Map();
 for(const row of session.packets)if('packet'in row){const packet=preparePacket(row.packet);
  if(packet.stream==='welcome'){const welcome=packet.decode();owners.push(welcome.player);handles.push(welcome.handle);}
  if(packet.stream==='commands')commands++;
  if(!row.delivered){assert.equal(row.direction,'up');assert.equal(row.channel,'unreliable');assert.equal(packet.stream,'commands');assert.ok(row.tick>=20&&row.tick<100);lost++;lostTicks.set(row.tick,(lostTicks.get(row.tick)??0)+1);}
 }
 assert.deepEqual(owners,['actor.player',...Array.from({length:31},(_,i)=>`dense:player:${i+1}`)]);assert.equal(new Set(handles).size,32);assert.equal(commands,5760);assert.equal(lost,2560);
 for(let tick=20;tick<100;tick++)assert.equal(lostTicks.get(tick),32);
 const counts=Array(32).fill(0);for(const [index,frame]of session.frames.entries()){const peer=index%32;counts[peer]++;assert.equal(frame.visible.includes(handles[peer]),false);assert.equal(frame.visible.length,91);assert.equal(frame.frame.rows.length,91);}
 assert.deepEqual(counts,Array(32).fill(91));
 assert.equal(session.frames.filter(frame=>frame.frame.tick>120&&frame.frame.tick<162&&frame.baseline===undefined).length,320);
 assert.equal(header.hash,'5124dbef574237cf721fbd2a5472b6315a8005bca189888e1d63b9c402c3b6e0');
 assert.ok(header.parts.every(part=>part.bytes<1000000));
 console.log(JSON.stringify({denseFrames:session.frames.length,parts:header.parts.length,storedBytes:header.parts.reduce((sum,part)=>sum+part.bytes,bytes(header).length),expandedBytes:header.expandedBytes,fullRecovery:session.frames.filter(frame=>frame.frame.tick>120&&frame.frame.tick<162&&frame.baseline===undefined).length}));
});
