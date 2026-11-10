// Manual Node + Chromium 4x benchmark; byte admission precedes every timer, exactly two runs, no automatic retries.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {getPriority,loadavg} from 'node:os';
import {build} from 'vite';
import {chromium} from 'playwright';
import {KEYCHAIN_ARGS} from '../../../scripts/chromium-keychain.mjs';
import {POLICY,compareRuns} from '../../../packages/wire/lib/bench/capture/benchmark-stats.js';
import {prepareTraffic} from '../../../packages/wire/lib/bench/capture/benchmark-data.js';
import {measureTraffic,benchmarkSink} from '../../../packages/wire/lib/bench/capture/benchmark.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const names=['walking','fight','ride','dense'];
const args=process.argv.slice(2);
assert.equal(args.length,1,'Give one owned JSON report path');
const output=resolve(args[0]);
assert.ok(output.startsWith(resolve(root,'tmp')+'/'),'Reports live in this checkout tmp');
mkdirSync(dirname(output),{recursive:true});
assert.equal(typeof global.gc,'function','Run the benchmark with node --expose-gc');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const source=execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(source,'','Timing requires an exactly committed clean source');
const priority={nice:getPriority(),parentNice:getPriority(process.ppid)};
assert.equal(priority.nice,0,'Use foreground check admission from a normal parent');
assert.equal(priority.parentNice,0,'Inherited background niceness cannot qualify');
const report={format:'wildshard-wire-benchmark/1',sha,engine:'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5',started:new Date().toISOString(),policy:POLICY,priority,clock:'mean: full ordered pass; p95: individual outer-call samples; no overhead subtraction',profiles:{},complete:false};
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const sourceFor=name=>new URL(`../../../packages/wire/bench/recordings/${name}/`,import.meta.url);
const manifests=Object.fromEntries(names.map(name=>[name,JSON.parse(readFileSync(new URL('manifest.json',sourceFor(name)),'utf8'))]));
report.manifests=Object.fromEntries(names.map(name=>[name,manifests[name].hash]));
save();
function note(profile,name,run,result){
  const raw=JSON.stringify(result)+'\n',rawFile=output.replace(/\.json$/u,`-${profile}-${name}-run${run+1}.json`);
  assert.notEqual(rawFile,output,'Report path must end in .json');writeFileSync(rawFile,raw);
  const compact={...result,encode:{...result.encode,samplesMs:undefined},decode:{...result.decode,samplesMs:undefined},raw:{file:rawFile.slice(root.length),sha256:createHash('sha256').update(raw).digest('hex')}};
  report.profiles[profile].runs[run][name]=compact;save();
  console.info(`${profile} ${name} run${run+1} frame bytes mean=${result.frameBytes.mean.toFixed(3)} p95=${result.frameBytes.p95} steady up=${result.steadyBytes.up} down=${result.steadyBytes.down} handshake up=${result.handshakeBytes.up} down=${result.handshakeBytes.down} welcome-max=${result.streams['down:welcome']?.maxBytes??0}`);
  console.info(`${profile} ${name} run${run+1} encode mean=${result.encode.meanMs.toFixed(6)}ms p95=${result.encode.p95Ms.toFixed(6)}ms decode mean=${result.decode.meanMs.toFixed(6)}ms p95=${result.decode.p95Ms.toFixed(6)}ms`);
}

async function native(){
  const profile=report.profiles.node={runtime:process.version,platform:process.platform,arch:process.arch,runs:[{},{}],stability:{}};
  for(let run=0;run<POLICY.runs;run++)for(const name of names){
    let traffic=await prepareTraffic(manifests[name],async file=>Uint8Array.from(readFileSync(new URL(file,sourceFor(name)))));
    global.gc();
    const observation=()=>({atMs:performance.now(),cpu:process.cpuUsage(),resource:process.resourceUsage(),load:loadavg()});
    const before=observation(),result=measureTraffic(traffic),after=observation();
    note('node',name,run,{...result,process:{scope:'whole measureTraffic call, including warm-up and statistics; not per-clock CPU',before,after}});
    assert.ok(benchmarkSink.value!==undefined&&typeof benchmarkSink.value==='object');traffic=undefined;benchmarkSink.value=undefined;global.gc();
  }
  for(const name of names)profile.stability[name]=compareRuns(profile.runs[0][name],profile.runs[1][name]);save();
}
async function phone(){
  const compiled=await build({configFile:false,root,logLevel:'error',build:{write:false,minify:false,lib:{entry:resolve(root,'packages/wire/lib/bench/capture/browser-benchmark.js'),formats:['es'],fileName:'wire-benchmark'},rolldownOptions:{output:{codeSplitting:false}}}});
  const built=Array.isArray(compiled)?compiled[0]:compiled,code=built.output.filter(row=>row.type==='chunk');assert.equal(code.length,1);
  const html='<link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wire timing proof</title><script type="module" src="/bench.js"></script>';
  const server=createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const path=new URL(req.url??'/', 'http://127.0.0.1').pathname;
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
    const profile=report.profiles.chromium4x={runtime:browser.version(),throttle:4,viewport:{width:390,height:844},isolated:true,runs:[{},{}],stability:{}};
    for(let run=0;run<POLICY.runs;run++)for(const name of names){
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
      await page.evaluate(()=>globalThis.wireBenchmark.release());await cdp.send('HeapProfiler.collectGarbage');
      await page.evaluate(async name=>await globalThis.wireBenchmark.prepare(name),name);await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      note('chromium4x',name,run,await page.evaluate(()=>globalThis.wireBenchmark.measure()));
      assert.equal(await page.evaluate(()=>{const value=globalThis.wireBenchmark.sink.value;return value!==undefined&&typeof value==='object'&&Object.keys(value).length>0;}),true,'Browser sink must remain observable outside clocks');
    }
    assert.deepEqual(errors,[]);for(const name of names)profile.stability[name]=compareRuns(profile.runs[0][name],profile.runs[1][name]);save();
  }finally{try{if(browser)await browser.close();}finally{await new Promise((yes,no)=>server.close(error=>error?no(error):yes()));}}
}
try{await native();await phone();report.complete=true;report.finished=new Date().toISOString();report.ok=Object.values(report.profiles).every(profile=>names.every(name=>profile.stability[name].ok));save();assert.equal(report.ok,true,'Two fixed timing runs differ by 3% or more; retain the red receipt and diagnose, never retry blindly');console.info('WS3 Node and Chromium4x two-run stability PASS');}catch(error){report.error=error instanceof Error?error.message:String(error);save();throw error;}
