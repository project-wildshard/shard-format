// Deliberately modify only the uncommitted encode tee in an owned scratch baseline.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Usage: install-capture-tee.mjs <owned-exact-cfd-engine>');
const root = realpathSync(resolve(process.argv[2])), sha = 'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
assert.equal(git(['rev-parse', 'HEAD']).trim(), sha);
const path = 'src/shared/engine/net/frame.ts', original = git(['show', `${sha}:${path}`]);
const entry = 'export function encodeFrame(writer: BitWriter, input: FrameInput): ArrayBuffer {';
assert.equal(original.split(entry).length, 2); assert.equal(original.split('  return writer.finish();').length, 2);
const patched = "import { startFrameCapture } from './wireCapture';\n" + original.replace(entry, entry + '\n  const capture = startFrameCapture(input);\n  input = capture.input;').replace('  return writer.finish();', '  const bytes = writer.finish();\n  capture.finish(bytes);\n  return bytes;');
const directory = resolve(root, 'src/shared/engine/net');
assert.equal(realpathSync(directory), directory, 'Refuse a redirected destination parent');
const ordinary = file => {
  const stat = lstatSync(file, { throwIfNoEntry: false });
  if (stat !== undefined) assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'Refuse a symlink or non-file destination');
};
ordinary(resolve(root, path));
ordinary(resolve(root, 'src/shared/engine/net/wireCapture.ts'));
const current = readFileSync(resolve(root, path), 'utf8');
assert.ok(current === original || current === patched, 'Refuse a foreign frame edit');
const template = readFileSync(new URL('../../packages/wire/bench/templates/wireCapture.ts.txt', import.meta.url), 'utf8');
const helperPath = resolve(root, 'src/shared/engine/net/wireCapture.ts');
const normalize = text => text.replace(/import \{ FrameTrace \} from '[^']+';/u, "import { FrameTrace } from '{{WIRE_TRACE_MODULE}}';");
if (existsSync(helperPath)) assert.equal(normalize(readFileSync(helperPath, 'utf8')), template, 'Refuse a foreign capture helper');
const allowed = new Set([path, 'src/client/game/boot/audio.generated.ts', 'src/client/game/boot/bytes.generated.ts', 'src/client/game/boot/versions.generated.ts']);
const changes = [...git(['diff', '--name-only', '-z']).split('\0'), ...git(['diff', '--cached', '--name-only', '-z']).split('\0')];
for (const changed of changes.filter(Boolean)) assert.ok(allowed.has(changed), `Baseline source is dirty: ${changed}`);
for (const untracked of git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) assert.equal(untracked, 'src/shared/engine/net/wireCapture.ts', 'Refuse an untracked baseline source');
const module = pathToFileURL(fileURLToPath(new URL('../../packages/wire/lib/bench/capture/frame-trace.js', import.meta.url))).href;
const expected = template.replace('{{WIRE_TRACE_MODULE}}', module);
if (process.argv.includes('--check')) {
  assert.equal(current, patched, 'Missing exact frame tee');
  assert.equal(readFileSync(helperPath, 'utf8'), expected, 'Capture module differs');
} else {
  writeFileSync(helperPath, expected);
  writeFileSync(resolve(root, path), patched);
}
console.log(`Installed only the exact encode tee at ${root}; frozen v0 replay remains mandatory`);
