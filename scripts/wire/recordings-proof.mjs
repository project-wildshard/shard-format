// Explicit CI integration proof, outside local hooks and default test discovery.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { archiveSession, readSessionArchive } from '../../packages/wire/lib/bench/capture/session-archive.js';
import { preparePacket } from '../../packages/wire/lib/bench/capture/packet-replay.js';
const root = new URL('../../packages/wire/bench/recordings/walking/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const load = async name => Uint8Array.from(readFileSync(new URL(name, root)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = value => new TextEncoder().encode(JSON.stringify(value) + '\n');
function check(name, work) {
  void test(name, { timeout: 9500 }, async () => {
    const start = performance.now(); await work();
    assert.ok(performance.now() - start < 9500, 'Complete recording proof exceeds 9.5 seconds');
  });
}
function stored(header, files) {
  const sections = { words: [], frames: [], packets: [] };
  for (const part of header.parts) sections[part.kind].push(...JSON.parse(new TextDecoder().decode(files.get(part.file))));
  return { version: 1, engine: header.engine, product: header.product, ticks: header.ticks,
    frames: { version: 1, wordTable: sections.words, frames: sections.frames }, packets: sections.packets };
}
async function resealed(kind, mutate) {
  const header = structuredClone(manifest), files = new Map(await Promise.all(header.parts.map(async part => [part.file, await load(part.file)])));
  const part = header.parts.find(row => row.kind === kind); assert.ok(part);
  const rows = JSON.parse(new TextDecoder().decode(files.get(part.file))); mutate(rows);
  const changed = bytes(rows); files.set(part.file, changed); part.bytes = changed.length; part.hash = digest(changed);
  const document = bytes(stored(header, files)); header.bytes = document.length; header.hash = digest(document);
  return { header, read: async name => { const result = files.get(name); assert.ok(result); return result; } };
}
check('the complete actual walking session survives below both original repository budgets', async () => {
  const session = await readSessionArchive(manifest, load);
  assert.equal(session.engine, 'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5');
  assert.equal(session.product, 'sunscar-dunes'); assert.equal(session.ticks, 1800);
  assert.equal(session.frames.length, 901); assert.equal(session.packets.length, 2706);
  assert.equal(session.frames.reduce((n, row) => n + row.rowFromCalls.length, 0), 14122);
  assert.equal(session.frames.reduce((n, row) => n + row.dueCalls.length, 0), 16498);
  assert.equal(session.packets.filter(row => !row.delivered).length, 80);
  assert.equal(session.frames.filter(row => row.frame.tick > 660 && row.baseline === undefined).length, 10);
  assert.ok(manifest.parts.every(part => part.bytes < 1000000));
  assert.ok(manifest.parts.reduce((n, part) => n + part.bytes, bytes(manifest).length) < 5000000);
  assert.equal(manifest.hash, '892662a38ce40cb58deb7a3077233fe7f902744b08d545c094386c191a19350c');
});
check('changed and truncated real part bytes refuse before producing a session', async () => {
  const first = manifest.parts[0]; assert.ok(first);
  await assert.rejects(readSessionArchive(manifest, async name => {
    const value = await load(name); if (name === first.file) value[0] ^= 1; return value;
  }), /part bytes differ/);
  await assert.rejects(readSessionArchive(manifest, async name => {
    const value = await load(name); return name === first.file ? value.subarray(0, -1) : value;
  }), /part bytes differ/);
});
check('missing, reordered and foreign recording parts cannot reach a consumer', async () => {
  await assert.rejects(readSessionArchive({ ...manifest, parts: manifest.parts.slice(0, -1) }, load), /content differs/);
  const parts = [...manifest.parts]; [parts[0], parts[1]] = [parts[1], parts[0]];
  await assert.rejects(readSessionArchive({ ...manifest, parts }, load), /complete and ordered/);
  let reads = 0;
  await assert.rejects(readSessionArchive({ ...manifest, parts: [{ ...manifest.parts[0], file: '../escape.json' }] }, async () => { reads++; throw new Error('Reader reached'); }));
  assert.equal(reads, 0);
});
check('a correctly rehashed corrupt non-frame packet still fails the frozen byte oracle', async () => {
  const mutation = await resealed('packets', rows => {
    const row = rows.find(packet => packet.packet !== undefined); assert.ok(row);
    const data = Buffer.from(row.packet.bytes, 'base64'); data[0] = 255; row.packet.bytes = data.toString('base64');
  });
  await assert.rejects(readSessionArchive(mutation.header, mutation.read), /frozen v0 stream/);
});
check('a valid-prefix packet with correctly resealed hashes still requires byte equality', async () => {
  const mutation = await resealed('packets', rows => {
    const row = rows.find(packet => packet.packet !== undefined && Buffer.from(packet.packet.bytes, 'base64')[0] === 6); assert.ok(row);
    const data = Buffer.from(row.packet.bytes, 'base64'); data[data.length - 1] ^= 1; row.packet.bytes = data.toString('base64');
  });
  await assert.rejects(readSessionArchive(mutation.header, mutation.read), /Frozen v0 packet replay differs from real bytes/);
});
check('a correctly rehashed frame cannot bypass exact per-handle frozen replay', async () => {
  const mutation = await resealed('frames', rows => {
    const row = rows[0]; assert.ok(row); const data = Buffer.from(row.bytes, 'base64');
    data[data.length - 1] ^= 1; row.bytes = data.toString('base64');
  });
  await assert.rejects(readSessionArchive(mutation.header, mutation.read), /Frozen v0 frame replay differs/);
});
check('actual frame references cannot be discarded even with valid file and content hashes', async () => {
  const mutation = await resealed('packets', rows => { const row = rows.find(packet => packet.frame !== undefined); assert.ok(row); row.frame = 901; });
  await assert.rejects(readSessionArchive(mutation.header, mutation.read), /Invalid or repeated captured frame reference/);
});
check('the writer also refuses corrupt capture bytes before publishing an archive', async () => {
  const files = new Map(await Promise.all(manifest.parts.map(async part => [part.file, await load(part.file)])));
  const source = stored(manifest, files), frame = source.frames.frames[0]; assert.ok(frame);
  frame.bytes = ''; await assert.rejects(archiveSession(source), /Frozen v0 frame replay differs/);
});

check('two real Driftwood clients preserve the complete fight, chat, command loss and recovery', async () => {
  const directory = new URL('../../packages/wire/bench/recordings/fight/', import.meta.url);
  const header = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
  const session = await readSessionArchive(header, async file => readFileSync(new URL(file, directory)));
  assert.equal(session.product, 'driftwood-isle'); assert.equal(session.ticks, 300);
  assert.equal(session.frames.length, 302); assert.equal(session.packets.length, 928);
  assert.equal(session.packets.filter(row => !row.delivered).length, 160);
  assert.equal(session.frames.filter(row => row.frame.tick > 240 && row.baseline === undefined).length, 20);
  const streams = {}, events = {}, owners = [];
  for (const row of session.packets) if ('packet' in row) {
    const packet = preparePacket(row.packet); streams[packet.stream] = (streams[packet.stream] ?? 0) + 1;
    if (packet.stream === 'welcome') owners.push(packet.decode().player);
    if (packet.stream === 'events') for (const event of packet.decode().events) events[event.kind] = (events[event.kind] ?? 0) + 1;
  }
  assert.deepEqual(owners, ['actor.player', 'bot:wire-fight']);
  assert.deepEqual(streams, { hello: 2, welcome: 2, events: 18, act: 4, commands: 600 });
  assert.equal(events.hit, 12); assert.equal(events.died, 2); assert.equal(events.chat, 8); assert.equal(events.reward, 2);
  assert.equal(header.hash, '0eb9ad661cabfbbce08da88e3a6183736ba8ba7b613a6a60b29183be0e897035');
});
