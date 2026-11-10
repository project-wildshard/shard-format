// Manual, real-Git write-boundary proof using an already-owned full baseline.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,renameSync,symlinkSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
if (!process.argv[2]) throw new Error('Usage: installer-proof.mjs <owned-exact-cfd-engine>');
const started=performance.now();
const root=fileURLToPath(new URL('../../',import.meta.url)),base=resolve(process.argv[2]);
const fixed=join(root,'scripts/wire/install-capture-tee.mjs');
mkdirSync(join(root,'tmp'),{recursive:true});const temporary=mkdtempSync(join(root,'tmp/wire-installer-proof-'));
try {
  const fixture=join(temporary,'engine'),old=join(temporary,'old.mjs');
  const git=args=>execFileSync('git',args,{cwd:fixture,encoding:'utf8',timeout:9500}).trim();
  execFileSync('git',['clone','--shared','--no-checkout','--local',base,fixture],{encoding:'utf8',timeout:9500});
  git(['sparse-checkout','set','--no-cone','/src/shared/engine/net/frame.ts','/src/server/engine/net/room.ts']);git(['checkout']);
  execFileSync(process.execPath,[fixed,fixture],{encoding:'utf8',timeout:9500});
  let source=readFileSync(fixed,'utf8');
  source=source.slice(0,source.indexOf('const directory ='))+source.slice(source.indexOf('const current ='));
  source=source.slice(0,source.indexOf('const changes ='))+"for (const changed of git(['diff', '--name-only']).trim().split('\\n').filter(Boolean)) assert.ok(allowed.has(changed), `Baseline source is dirty: ${changed}`);\n"+source.slice(source.indexOf('const module ='));
  for(const path of ['bench/templates/wireCapture.ts.txt','lib/bench/capture/frame-trace.js']) {
    const relative=`../../packages/wire/${path}`,absolute=pathToFileURL(join(root,'packages/wire',path)).href;
    source=source.replace(`new URL('${relative}', import.meta.url)`,`new URL('${absolute}')`);
  }
  writeFileSync(old,source,{flag:'wx'});
  const run=file=>spawnSync(process.execPath,[file,fixture,'--check'],{encoding:'utf8',timeout:9500});
  const room='src/server/engine/net/room.ts',original=execFileSync('git',['show',`HEAD:${room}`],{cwd:fixture,encoding:'utf8',timeout:9500});
  writeFileSync(join(fixture,room),original+'\n// Owned staged-only mutation.\n');git(['add',room]);
  const before=run(old),after=run(fixed);assert.equal(before.status,0,before.stderr);assert.notEqual(after.status,0);assert.match(after.stderr,/Baseline source is dirty: src\/server\/engine\/net\/room.ts/);
  git(['update-index','--cacheinfo',`100644,${git(['rev-parse',`HEAD:${room}`])},${room}`]);writeFileSync(join(fixture,room),original);
  const helper=join(fixture,'src/shared/engine/net/wireCapture.ts'),outside=join(temporary,'redirected-helper.ts');
  renameSync(helper,helper+'.owned');
  const target=readFileSync(helper+'.owned','utf8').replace(/import \{ FrameTrace \} from '[^']+';/u,"import { FrameTrace } from 'file:///not-the-owner.js';");
  writeFileSync(outside,target,{flag:'wx'});symlinkSync(outside,helper);
  const accepted=spawnSync(process.execPath,[old,fixture],{encoding:'utf8',timeout:9500});assert.equal(accepted.status,0,accepted.stderr);assert.notEqual(readFileSync(outside,'utf8'),target);
  writeFileSync(outside,target);
  const refused=spawnSync(process.execPath,[fixed,fixture],{encoding:'utf8',timeout:9500});assert.notEqual(refused.status,0);assert.match(refused.stderr,/Refuse a symlink or non-file destination/);assert.equal(readFileSync(outside,'utf8'),target);
  assert.ok(performance.now()-started<9500,'Complete installer proof exceeds9.5seconds');
  console.log('Real Git staged-only edit: old accepts, fixed refuses; real symlink: old overwrites outside target, fixed refuses with outside bytes untouched');
} finally { rmSync(temporary,{recursive:true}); }
