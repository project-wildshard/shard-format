import assert from 'node:assert/strict';
import {capturePacket} from '../../packages/wire/lib/bench/capture/packet-replay.js';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {archiveGraphSession} from '../../packages/wire/lib/bench/capture/session-graph.js';
const root=resolve(process.argv[2] ?? ''), output=resolve(process.argv[3] ?? '');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: capture-dense.mjs <exact-cfd-engine> <new-output-directory>');
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
  const bytes=new Uint8Array(buffer),lost=direction==='up'&&bytes[0]===2&&tick>=20&&tick<100;
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
const resident=await createTrustedHeadlessResident({product,shard:product.shardfile,assets:runtimeAssets(product,directory),rapier},undefined,{room:true});
let recipe,base;
try{
 const actor=[...resident.host.entities.values()].find(actor=>actor.snapshot().flight===null);assert.ok(actor);
 const adapter=resident.host.adapters.get(`runtime.actor.${actor.entityId}`);assert.ok(adapter);
 recipe=JSON.parse(adapter.snapshot());assert.ok(recipe.spec);base=resident.host.level;
}finally{resident.dispose();}
const {createSimHost}=await fromEngine('src/server/engine/sim.ts');
const at=index=>({x:(index%10)*3-15,y:0,z:Math.floor(index/10)*3-15});
const level={version:3,id:'wire-dense-benchmark',seed:12345,ground:{size:128,height:0},player:{...base.player,at:at(0)},weapon:base.weapon,quests:[],entities:Array.from({length:60},(_,i)=>({...recipe,id:`dense:creature:${i}`,seed:i+100,at:at(i+32),yaw:i/10}))};
const host=createSimHost(level,{rapier});let room;const clients=[];
try{
const players=[leadPlayer(host),...Array.from({length:31},(_,i)=>host.addPlayer(`dense:player:${i+1}`,at(i+1),i/8))];
host.onStep('benchmark:patrol',()=>{let i=0;for(const animal of host.entities.values()){animal.setMotion(i/10+host.state.tick/90,1+(i%3)*0.3);i++;}});
for(let i=0;i<60;i++)host.step();
const playerStart=players.map(player=>player.position.clone()),creatureStart=[...host.entities.values()].map(actor=>actor.position.clone());
const world=new SimNetWorld(host),links=players.map(()=>directLoopback());
room=new NetRoom({world,step:inputs=>host.step(new Map(inputs.filter(input=>input.command!==null).map(input=>[input.player,input.command])))});
for(const [i,player]of players.entries()){
 const client=new NetClient(tee(links[i].client,'up'));clients.push(client);
 room.join(tee(links[i].server,'down'),world.playerOf(player.id));client.hello('',{player:`device:wire-dense-${i}`,name:`Dense ${i}`});links[i].pump();
}
room.open();links.forEach(link=>link.pump());
for(tick=0;tick<180;tick++){
 for(const [i,client]of clients.entries()){
  client.command({viewTick:0,steer:{keyX:Math.sin((tick+i)/35),keyY:1,stickX:0,stickY:0},yaw:i/8+tick/150,pitch:0,buttons:0});client.flush();links[i].pump();
 }
 room.tick();links.forEach(link=>link.pump());
}
assert.equal(host.players.size,32);assert.equal(host.entities.size,60);assert.ok(clients.every(client=>client.dropped===0));
const movingPlayers=players.filter((player,i)=>player.position.distanceTo(playerStart[i])>0.1).length;
const movingCreatures=[...host.entities.values()].filter((actor,i)=>actor.position.distanceTo(creatureStart[i])>0.1).length;
assert.equal(movingPlayers,32);assert.equal(movingCreatures,60);
const {packFrameWords}=await import('../../packages/wire/lib/bench/capture/frame-words.js');
const document={version:1,engine:'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5',product:'synthetic-dense-32-60',ticks:180,frames:packFrameWords(records),packets};
const archive=await archiveGraphSession(document);
mkdirSync(output,{recursive:false});
for(const [file,bytes]of archive.files)writeFileSync(join(output,file),bytes,{flag:'wx'});
writeFileSync(join(output,'manifest.json'),JSON.stringify(archive.manifest)+'\n',{flag:'wx'});
console.log(JSON.stringify({players:host.players.size,creatures:host.entities.size,movingPlayers,movingCreatures,frames:records.length,packets:packets.length,expandedBytes:archive.manifest.expandedBytes,sourceHash:archive.manifest.hash,liveSockets:0}));
}finally{clients.forEach(client=>client.dispose());room?.dispose();host.dispose();}
