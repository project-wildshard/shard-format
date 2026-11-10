import assert from 'node:assert/strict';
import {capturePacket} from '../../packages/wire/lib/bench/capture/packet-replay.js';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {archiveSession} from '../../packages/wire/lib/bench/capture/session-archive.js';
const root=resolve(process.argv[2] ?? ''), output=resolve(process.argv[3] ?? '');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: capture-walking.mjs <exact-cfd-engine> <new-output-directory>');
execFileSync(process.execPath,[fileURLToPath(new URL('./install-capture-tee.mjs',import.meta.url)),root,'--check']);
const fromEngine=async file=>import(pathToFileURL(join(root,file)).href);

const {installFrameCapture}=await fromEngine('src/shared/engine/net/wireCapture.ts');
const {NetClient}=await fromEngine('src/client/engine/net/client.ts');
const {NetRoom}=await fromEngine('src/server/engine/net/room.ts');
const {SimNetWorld}=await fromEngine('src/server/engine/net/simWorld.ts');
const {loadHeadlessProduct}=await fromEngine('src/server/host/headlessProduct.ts');
const {createTrustedHeadlessResident}=await fromEngine('src/server/host/headlessRuntime.ts');
const {runtimeAssets}=await fromEngine('test/fixtures/engine-lift/product.ts');
const {loadRapier}=await fromEngine('src/shared/engine/physics/rapier.ts');
const {leadPlayer}=await fromEngine('src/shared/engine/sim/leadPlayer.ts');
const {stepResident}=await fromEngine('src/shared/host/standalone/netInput.ts');
const {directLoopback}=await fromEngine('src/test/engine/netLoopback.ts');
const {installAppIdentity}=await fromEngine('src/shared/engine/app/identity.ts');
const {WILDSHARD_IDENTITY}=await fromEngine('src/client/game/identity.ts');
const {installEngineStrings}=await fromEngine('src/shared/engine/strings.ts');
const {ENGINE_CONTENT_STRINGS}=await fromEngine('src/client/game/engineStrings.ts');
installAppIdentity(WILDSHARD_IDENTITY);installEngineStrings(ENGINE_CONTENT_STRINGS);
const records=[],packets=[];let tick=0;installFrameCapture(record=>records.push(record));
function tee(inner,direction){return {
 get stats(){return inner.stats;},
 send(channel,buffer){
  const bytes=new Uint8Array(buffer),lost=direction==='up'&&bytes[0]===2&&tick>=600&&tick<680;
  let captured;
  if(bytes[0]===5){const record=records.at(-1);assert.ok(record);assert.equal(record.bytes,Buffer.from(bytes).toString('base64'));captured={frame:records.length-1};}
  else captured={packet:capturePacket(bytes)};
  packets.push({tick,direction,channel,delivered:!lost,...captured});
  if(!lost)inner.send(channel,buffer);
 },
 onMessage:inner.onMessage.bind(inner),onClose:inner.onClose.bind(inner),close:inner.close.bind(inner)
};}
process.chdir(root);
const directory=join(root,'out/sunscar-dunes');
const product=await loadHeadlessProduct(directory);
const rapier=await loadRapier(readFileSync(root+'/public/assets/physics/rapier.wasm'));
const live=await createTrustedHeadlessResident({product,shard:product.shardfile,assets:runtimeAssets(product,directory),rapier},undefined,{room:true});
let room,client;
try{
const body=leadPlayer(live.host),world=new SimNetWorld(live.host),link=directLoopback();
const start=body.position.clone();
room=new NetRoom({world,step:inputs=>stepResident(live,body.id,inputs)});
client=new NetClient(tee(link.client,'up'));room.join(tee(link.server,'down'));client.hello('',{player:'device:wire-probe',name:'Wire agent'});link.pump();room.open();link.pump();
client.act({kind:'chat',seq:0,channel:'room',text:'WS3 isolated recording'});link.pump();
for(tick=0;tick<1800;tick+=1){client.command({viewTick:0,steer:{keyX:0,keyY:1,stickX:0,stickY:0},yaw:0.4,pitch:0,buttons:8});client.flush();link.pump();room.tick();link.pump();}
assert.ok(records.length>=900);assert.ok(records.some(r=>r.rowFromCalls.length>0));assert.ok(records.some(r=>r.dueCalls.length>0));
assert.equal(client.dropped,0);assert.ok(body.position.distanceTo(start)>1);
const report={engine:'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5',product:'sunscar-dunes',ticks:1800,frames:records.length,rowFromCalls:records.reduce((n,r)=>n+r.rowFromCalls.length,0),dueCalls:records.reduce((n,r)=>n+r.dueCalls.length,0),byteIdentical:records.length,displacement:body.position.distanceTo(start),dropped:client.dropped,liveSockets:0};
const lost=packets.filter(p=>!p.delivered).length,fullAfterLost=records.filter(r=>r.frame.tick>660&&r.baseline===undefined).length;
assert.ok(lost>0);assert.ok(fullAfterLost>0);
const recording={version:1,engine:report.engine,product:report.product,ticks:1800,frames:records,packets};
const {packFrameWords}=await import('../../packages/wire/lib/bench/capture/frame-words.js');
const archive=await archiveSession({...recording,frames:packFrameWords(records)});
mkdirSync(output,{recursive:false});
for(const [file,bytes] of archive.files)writeFileSync(join(output,file),bytes,{flag:'wx'});
writeFileSync(join(output,'manifest.json'),JSON.stringify(archive.manifest)+'\n',{flag:'wx'});
report.recordingBytes=archive.manifest.bytes;report.packets=packets.length;report.lost=lost;report.fullAfterLost=fullAfterLost;
console.log(JSON.stringify(report));
}finally{client?.dispose();room?.dispose();live.dispose();}
