import assert from 'node:assert/strict';
import {capturePacket} from '../../packages/wire/lib/bench/capture/packet-replay.js';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {archiveSession} from '../../packages/wire/lib/bench/capture/session-archive.js';
const root=resolve(process.argv[2] ?? ''), output=resolve(process.argv[3] ?? '');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: capture-fight.mjs <exact-cfd-engine> <new-output-directory>');
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
  const bytes=new Uint8Array(buffer),lost=direction==='up'&&bytes[0]===2&&tick>=180&&tick<260;
  let captured;
  if(bytes[0]===5){const record=records.at(-1);assert.ok(record);assert.equal(record.bytes,Buffer.from(bytes).toString('base64'));captured={frame:records.length-1};}
  else captured={packet:capturePacket(bytes)};
  packets.push({tick,direction,channel,delivered:!lost,...captured});
  if(!lost)inner.send(channel,buffer);
 },
 onMessage:inner.onMessage.bind(inner),onClose:inner.onClose.bind(inner),close:inner.close.bind(inner)
};}
process.chdir(root);
const directory=join(root,'out/driftwood-isle');
const product=await loadHeadlessProduct(directory);
const rapier=await loadRapier(readFileSync(root+'/public/assets/physics/rapier.wasm'));
const live=await createTrustedHeadlessResident({product,shard:product.shardfile,assets:runtimeAssets(product,directory),rapier},undefined,{room:true});
let room;let clients=[];
try{
const body=leadPlayer(live.host), world=new SimNetWorld(live.host);
const target=[...live.host.entities.values()].find(actor=>actor.kind==='crab'&&actor.alive);
assert.ok(target,'Actual Driftwood has no crab');
const at=target.position.clone(),y=live.host.groundHeightAt(at.x,at.z+1.4);
body.resetPose({x:at.x,y,z:at.z+1.4},0);
const bot=live.host.addPlayer('bot:wire-fight',{x:at.x,y,z:at.z-1.4},Math.PI);
const bots=[body,bot], links=bots.map(()=>directLoopback());clients=links.map(link=>new NetClient(tee(link.client,'up')));
let hits=0,deaths=0;
room=new NetRoom({world,step:inputs=>stepResident(live,body.id,inputs)});
clients.forEach((client,index)=>{room.join(tee(links[index].server,'down'),world.playerOf(bots[index].id));client.onCombat(event=>{if(event.kind==='hit')hits++;if(event.kind==='died')deaths++;});client.hello('',{player:`device:wire-fight-${index}`,name:`Wire bot ${index}`});links[index].pump();});
room.open();links.forEach(link=>link.pump());const before=target.hp;
for(tick=0;tick<300;tick++){
  for(const [index,client]of clients.entries()){
    const player=bots[index],dx=target.position.x-player.position.x,dz=target.position.z-player.position.z,distance=Math.hypot(dx,dz),yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(target.position.y+target.dims.bodyY*target.scale-(player.position.y+1.68),distance);
    const attack=tick%20===index*3?{attack:{aim:{origin:{x:0,y:0,z:0},direction:{x:-Math.sin(yaw),y:0,z:-Math.cos(yaw)}}}}:{};
    if(tick===0||tick===200)client.act({kind:'chat',seq:0,channel:'room',text:`Wire fight bot ${index} at ${tick}`});
    client.command({viewTick:0,steer:{keyX:0,keyY:distance>1.5?1:0,stickX:0,stickY:0},yaw,pitch,buttons:0,...attack});client.flush();links[index].pump();
  }
  room.tick();links.forEach(link=>link.pump());
}
const {packFrameWords}=await import('../../packages/wire/lib/bench/capture/frame-words.js');
assert.equal(bots.length,2);assert.ok(hits>0);assert.ok(deaths>0);assert.ok(target.hp<before);assert.ok(clients.every(client=>client.dropped===0));
const lost=packets.filter(packet=>!packet.delivered).length,fullAfterLost=records.filter(record=>record.frame.tick>240&&record.baseline===undefined).length;
assert.ok(lost>0);assert.ok(fullAfterLost>0);
const archive=await archiveSession({version:1,engine:'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5',product:'driftwood-isle',ticks:300,frames:packFrameWords(records),packets});
mkdirSync(output,{recursive:false});
for(const [file,bytes]of archive.files)writeFileSync(join(output,file),bytes,{flag:'wx'});
writeFileSync(join(output,'manifest.json'),JSON.stringify(archive.manifest)+'\n',{flag:'wx'});
console.log(JSON.stringify({ticks:300,players:bots.length,creatures:live.host.entities.size,frames:records.length,packets:packets.length,hitNotifications:hits,diedNotifications:deaths,hpBefore:before,hpAfter:target.hp,lost,fullAfterLost,recordingBytes:archive.manifest.bytes,sourceHash:archive.manifest.hash,dropped:clients.map(client=>client.dropped),liveSockets:0}));
}finally{clients.forEach(client=>client.dispose());room?.dispose();live.dispose();}
