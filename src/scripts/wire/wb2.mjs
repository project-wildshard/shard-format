// WIRE-STABILITY WB2 (5.7): replay the WS3 recordings through frozen v0 and v1, interleaved, on Node and Chromium at
// 4x CPU throttle, and judge v1 against the gate. Bytes are deterministic; v1's second shape (per-field tags) is
// counted for the record, never gated. Timings alternate codec order per run so drift lands on both sides.
// Usage: node --expose-gc src/scripts/wire/wb2.mjs tmp/<lane>/wb2.json
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadavg} from 'node:os';
import {build} from 'vite';
import {chromium} from 'playwright';
import {KEYCHAIN_ARGS} from '../../../scripts/chromium-keychain.mjs';
import {POLICY} from '../../../packages/wire/lib/bench/capture/benchmark-stats.js';
import {prepareTraffic,trafficBytes} from '../../../packages/wire/lib/bench/capture/benchmark-data.js';
import {measureTraffic,benchmarkSink} from '../../../packages/wire/lib/bench/capture/benchmark.js';
import {readSessionArchive} from '../../../packages/wire/lib/bench/capture/session-archive.js';
import {prepareV1Traffic} from '../../../packages/wire/lib/bench/capture/v1-traffic.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const names=(process.env.WB2_RECORDINGS??'walking,fight,ride,dense').split(',');
const profiles=(process.env.WB2_PROFILES??'node,chromium4x').split(',');
const args=process.argv.slice(2);
assert.equal(args.length,1,'Give one owned JSON report path');
const output=resolve(args[0]);
assert.ok(output.startsWith(resolve(root,'tmp')+'/'),'Reports live in this checkout tmp');
mkdirSync(dirname(output),{recursive:true});
assert.equal(typeof global.gc,'function','Run with node --expose-gc');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=execFileSync('git',['status','--porcelain','--untracked-files=normal','--','packages/wire','src/scripts/wire'],{cwd:root,encoding:'utf8'}).trim();
const GATE={bytes:1.10,encode:1.10,decodeP95:1.25,welcome:2048};
const report={format:'wildshard-wire-wb2/1',sha,dirty:dirty!=='',started:new Date().toISOString(),policy:POLICY,gate:GATE,bytes:{},profiles:{},complete:false};
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const sourceFor=name=>new URL(`../../../packages/wire/bench/recordings/${name}/`,import.meta.url);
const manifests=Object.fromEntries(names.map(name=>[name,JSON.parse(readFileSync(new URL('manifest.json',sourceFor(name)),'utf8'))]));
const reader=name=>async file=>Uint8Array.from(readFileSync(new URL(file,sourceFor(name))));
const ratio=(a,b)=>b===0?(a===0?1:Infinity):a/b;

/** Bytes: v0, v1 tables, v1 per-field tags. Deterministic, so once, in Node. */
async function bytes(){
  for(const name of names){
    const session=await readSessionArchive(manifests[name],reader(name));
    const shapes={v0:trafficBytes(await prepareTraffic(manifests[name],reader(name))),tables:trafficBytes(prepareV1Traffic(session)),tags:trafficBytes(prepareV1Traffic(session,'tags'))};
    const view=b=>({frameMean:b.frameBytes.mean,frameP95:b.frameBytes.p95,up:b.steadyBytes.up,down:b.steadyBytes.down,handshakeUp:b.handshakeBytes.up,handshakeDown:b.handshakeBytes.down,welcomeMax:b.streams['down:welcome']?.maxBytes??0});
    const row=Object.fromEntries(Object.entries(shapes).map(([shape,b])=>[shape,view(b)]));
    for(const shape of ['tables','tags'])row[`${shape}Ratio`]={frameMean:ratio(row[shape].frameMean,row.v0.frameMean),frameP95:ratio(row[shape].frameP95,row.v0.frameP95),up:ratio(row[shape].up,row.v0.up),down:ratio(row[shape].down,row.v0.down)};
    report.bytes[name]=row;save();
    console.info(`bytes ${name} tables x${Object.values(row.tablesRatio).map(v=>v.toFixed(4)).join('/')} tags x${Object.values(row.tagsRatio).map(v=>v.toFixed(3)).join('/')} welcome ${row.tables.welcomeMax} B`);
  }
}
const cpuView=r=>({encodeMean:r.encode.meanMs,encodeP95:r.encode.p95Ms,decodeMean:r.decode.meanMs,decodeP95:r.decode.p95Ms,encodeStreams:Object.fromEntries(Object.entries(r.encode.streams).map(([k,v])=>[k,{mean:v.mean,p95:v.p95}])),decodeStreams:Object.fromEntries(Object.entries(r.decode.streams).map(([k,v])=>[k,{mean:v.mean,p95:v.p95}]))});
function record(profile,name,run,codec,result){
  const runs=report.profiles[profile].runs;runs[run]??={};runs[run][name]??={};runs[run][name][codec]=cpuView(result);save();
  const v=runs[run][name];
  if(v.v0&&v.v1)console.info(`${profile} ${name} run${run+1} encode x${ratio(v.v1.encodeMean,v.v0.encodeMean).toFixed(3)} mean x${ratio(v.v1.encodeP95,v.v0.encodeP95).toFixed(3)} p95 | decode x${ratio(v.v1.decodeMean,v.v0.decodeMean).toFixed(3)} mean x${ratio(v.v1.decodeP95,v.v0.decodeP95).toFixed(3)} p95 | load ${loadavg()[0].toFixed(1)}`);
}
const orderFor=run=>run%2===0?['v0','v1']:['v1','v0'];
async function native(){
  report.profiles.node={runtime:process.version,platform:process.platform,arch:process.arch,runs:[]};
  for(let run=0;run<POLICY.runs;run++)for(const name of names)for(const codec of orderFor(run)){
    let traffic=codec==='v1'?prepareV1Traffic(await readSessionArchive(manifests[name],reader(name))):await prepareTraffic(manifests[name],reader(name));
    global.gc();const result=measureTraffic(traffic);record('node',name,run,codec,result);
    traffic=undefined;benchmarkSink.value=undefined;global.gc();
  }
}
async function phone(){
  const compiled=await build({configFile:false,root,logLevel:'error',build:{write:false,minify:false,lib:{entry:resolve(root,'packages/wire/lib/bench/capture/browser-benchmark.js'),formats:['es'],fileName:'wire-benchmark'},rolldownOptions:{output:{codeSplitting:false}}}});
  const built=Array.isArray(compiled)?compiled[0]:compiled,code=built.output.filter(row=>row.type==='chunk');assert.equal(code.length,1);
  const html='<link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wire WB2</title><script type="module" src="/bench.js"></script>';
  const server=createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const path=new URL(req.url??'/','http://127.0.0.1').pathname;
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
    if(path==='/bench.js'){res.setHeader('Content-Type','text/javascript');res.end(code[0].code);return;}
    const match=/^\/recordings\/(walking|fight|ride|dense)\/(manifest\.json|part-\d{3}\.json)$/u.exec(path);
    if(!match){res.writeHead(404);res.end();return;}
    try{res.setHeader('Content-Type','application/json');res.end(readFileSync(new URL(match[2],sourceFor(match[1]))));}catch{res.writeHead(404);res.end();}
  });
  let browser;
  try{
    await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
    const address=server.address();assert.ok(address&&typeof address!=='string');
    browser=await chromium.launch({headless:true,args:[...KEYCHAIN_ARGS,'--mute-audio']});
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/`);await page.waitForFunction(()=>globalThis.wireBenchmark!==undefined);
    assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
    const cdp=await context.newCDPSession(page);
    report.profiles.chromium4x={runtime:browser.version(),throttle:4,isolated:true,runs:[]};
    for(let run=0;run<POLICY.runs;run++)for(const name of names)for(const codec of orderFor(run)){
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
      await page.evaluate(()=>globalThis.wireBenchmark.release());await cdp.send('HeapProfiler.collectGarbage');
      await page.evaluate(async([name,codec])=>await globalThis.wireBenchmark.prepare(name,codec),[name,codec]);await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      record('chromium4x',name,run,codec,await page.evaluate(()=>globalThis.wireBenchmark.measure()));
    }
    assert.deepEqual(errors,[]);
  }finally{try{if(browser)await browser.close();}finally{await new Promise((yes,no)=>server.close(error=>error?no(error):yes()));}}
}
/** The gate: each run's v1/v0 ratio, judged on the mean ratio of the two runs (no retries). */
function judge(){
  const verdict={};
  for(const name of names){
    const b=report.bytes[name];
    const bytesOk=['frameMean','frameP95','up','down'].every(k=>b.tablesRatio[k]<=GATE.bytes)&&b.tables.welcomeMax<=GATE.welcome;
    const cpu={};
    for(const profile of Object.keys(report.profiles)){
      const runs=report.profiles[profile].runs.map(run=>run[name]).filter(Boolean).map(v=>({encodeMean:ratio(v.v1.encodeMean,v.v0.encodeMean),encodeP95:ratio(v.v1.encodeP95,v.v0.encodeP95),decodeMean:ratio(v.v1.decodeMean,v.v0.decodeMean),decodeP95:ratio(v.v1.decodeP95,v.v0.decodeP95)}));
      const best=k=>runs.reduce((sum,r)=>sum+r[k],0)/runs.length;
      cpu[profile]={runs,encodeOk:best('encodeMean')<=GATE.encode&&best('encodeP95')<=GATE.encode,decodeP95Ok:best('decodeP95')<=GATE.decodeP95};
    }
    verdict[name]={bytesOk,cpu,gateOk:bytesOk&&(cpu.chromium4x?.encodeOk??false)};
  }
  return verdict;
}
try{
  await bytes();
  if(profiles.includes('node'))await native();
  if(profiles.includes('chromium4x'))await phone();
  report.verdict=judge();report.complete=true;report.finished=new Date().toISOString();save();
  for(const [name,v] of Object.entries(report.verdict))console.info(`WB2 ${name}: bytes ${v.bytesOk?'PASS':'FAIL'}; ${Object.entries(v.cpu).map(([p,c])=>`${p} encode ${c.encodeOk?'PASS':'FAIL'} decode-p95 ${c.decodeP95Ok?'within 1.25':'over 1.25 (Opus decides)'}`).join('; ')}`);
}catch(error){report.error=error instanceof Error?error.stack:String(error);save();throw error;}
