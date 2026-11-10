import assert from 'node:assert/strict';
import {capturePacket} from '../../packages/wire/lib/bench/capture/packet-replay.js';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {archiveSession} from '../../packages/wire/lib/bench/capture/session-archive.js';
const root=resolve(process.argv[2] ?? ''), output=resolve(process.argv[3] ?? '');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: capture-ride.mjs <exact-cfd-engine> <new-output-directory>');
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
  const bytes=new Uint8Array(buffer),lost=direction==='up'&&bytes[0]===2&&tick>=80&&tick<160;
  let captured;
  if(bytes[0]===5){const record=records.at(-1);assert.ok(record);assert.equal(record.bytes,Buffer.from(bytes).toString('base64'));captured={frame:records.length-1};}
  else captured={packet:capturePacket(bytes)};
  packets.push({tick,direction,channel,delivered:!lost,...captured});
  if(!lost)inner.send(channel,buffer);
 },
 onMessage:inner.onMessage.bind(inner),onClose:inner.onClose.bind(inner),close:inner.close.bind(inner)
};}
process.chdir(root);
const directory=join(root,'out/nalati-grasslands');
const product=await loadHeadlessProduct(directory);
const rapier=await loadRapier(readFileSync(root+'/public/assets/physics/rapier.wasm'));
const live=await createTrustedHeadlessResident({product,shard:product.shardfile,assets:runtimeAssets(product,directory),rapier},undefined,{room:true});
let room,client;
try{
const body=leadPlayer(live.host),world=new SimNetWorld(live.host),link=directLoopback();
const {mountedPlayerOf}=await fromEngine('src/server/game/riding/native.ts');
const seat=mountedPlayerOf(live.host);assert.ok(seat,'Actual Nalati has no mounted law');
const horse=seat.mountables.find(actor=>seat.canRide(actor.entityId));assert.ok(horse,'Actual Nalati has no available camp horse');
body.resetPose({x:horse.position.x,y:live.host.groundHeightAt(horse.position.x,horse.position.z+1),z:horse.position.z+1},horse.yaw);
const start=body.position.clone(),gaits=new Set();let rode=false;
room=new NetRoom({world,step:inputs=>stepResident(live,body.id,inputs)});
client=new NetClient(tee(link.client,'up'));room.join(tee(link.server,'down'));client.hello('',{player:'device:wire-ride',name:'Wire rider'});link.pump();room.open();link.pump();
for(tick=0;tick<240;tick++){
  if(tick===0)client.act({kind:'ride',seq:0,action:'mount'});
  if(tick===230)client.act({kind:'ride',seq:0,action:'dismount'});
  client.command({viewTick:0,steer:{keyX:tick>120&&tick<230?1:0,keyY:tick<230?1:0,stickX:0,stickY:0},yaw:horse.yaw,pitch:0,buttons:tick>=120?8:0});
  client.flush();link.pump();room.tick();link.pump();
  if(seat.mounted){rode=true;gaits.add(seat.body.gait);}
}
assert.ok(rode);assert.equal(seat.mounted,false);assert.equal(client.dropped,0);assert.ok(body.position.distanceTo(start)>1);
const mounted=records.filter(record=>(record.rideWords??0)>0).length;assert.ok(mounted>0);assert.ok(records.some(record=>(record.rideWords??0)===0));
const lost=packets.filter(packet=>!packet.delivered).length,fullAfterLost=records.filter(record=>record.frame.tick>140&&record.baseline===undefined).length;assert.ok(lost>0);assert.ok(fullAfterLost>0);
const {packFrameWords}=await import('../../packages/wire/lib/bench/capture/frame-words.js');
const archive=await archiveSession({version:1,engine:'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5',product:'nalati-grasslands',ticks:240,frames:packFrameWords(records),packets});
mkdirSync(output,{recursive:false});
for(const [file,bytes]of archive.files)writeFileSync(join(output,file),bytes,{flag:'wx'});
writeFileSync(join(output,'manifest.json'),JSON.stringify(archive.manifest)+'\n',{flag:'wx'});
console.log(JSON.stringify({ticks:240,horse:horse.entityId,frames:records.length,mountedFrames:mounted,packets:packets.length,gaits:[...gaits],displacement:body.position.distanceTo(start),lost,fullAfterLost,recordingBytes:archive.manifest.bytes,sourceHash:archive.manifest.hash,dropped:client.dropped,liveSockets:0}));
}finally{client?.dispose();room?.dispose();live.dispose();}
