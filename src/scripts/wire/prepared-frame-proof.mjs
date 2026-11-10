// Explicit CI byte-oracle proof; no timing result is inferred from this test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {BitWriter} from '../../../packages/wire/lib/frozen/v0/bits.js';
import {bytesText, unpackDoubles, unpackWords} from '../../../packages/wire/lib/bench/capture/frame-data.js';
import {prepareFrame} from '../../../packages/wire/lib/bench/capture/prepared-frame.js';
import {preparePacket} from '../../../packages/wire/lib/bench/capture/packet-replay.js';
import {readSessionArchive} from '../../../packages/wire/lib/bench/capture/session-archive.js';

async function read(name) {
  const root = new URL('../../../packages/wire/bench/recordings/' + name + '/', import.meta.url);
  const header = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  return await readSessionArchive(header, async file => readFileSync(new URL(file, root)));
}
function check(name, work) {
  void test(name, {timeout:9500}, async () => {
    const started = performance.now(); await work();
    assert.ok(performance.now() - started < 9500, 'Complete prepared-codec proof exceeds 9.5 seconds');
  });
}

check('actual walking frames and packets retain every byte with a reused room writer', async () => {
  const session = await read('walking'), writer = new BitWriter(4096), shared = () => writer;
  for (const frame of session.frames) {
    const prepared = prepareFrame(frame), decoded = prepared.decode();
    assert.equal(bytesText(new Uint8Array(prepared.encode(shared))), frame.bytes);
    assert.equal(decoded.tick, frame.frame.tick); assert.equal(decoded.cell, frame.cell);
    assert.equal(decoded.lastSeq, frame.lastSeq); assert.deepEqual(decoded.owner, unpackDoubles(frame.owner));
  }
  for (const row of session.packets) if ('packet' in row) {
    const prepared = preparePacket(row.packet);
    assert.equal(bytesText(new Uint8Array(prepared.encodeWith(shared))), row.packet.bytes);
  }
  assert.equal(session.frames.length, 901); assert.equal(session.packets.length, 2706);
});

check('the real fight never turns a spawn-only handle into a receiver baseline row', async () => {
  const session = await read('fight'), frame = session.frames[69]; assert.ok(frame);
  assert.equal(frame.frame.tick, 68);
  assert.equal(frame.baseline.frame.rows.find(row => row.handle === 54).words, '');
  const prepared = prepareFrame(frame), decoded = prepared.decode();
  assert.equal(decoded.rows.has(54), false); assert.equal(decoded.tick, 68);
  assert.deepEqual(decoded.owner, unpackDoubles(frame.owner));
  const writer = new BitWriter(4096), shared = () => writer;
  for (let repeat = 0; repeat < 3; repeat++) {
    assert.equal(bytesText(new Uint8Array(prepared.encode(shared))), frame.bytes);
    assert.equal(prepared.decode().rows.has(54), false);
  }
});

function changesMask(frame, call) {
  const current = frame.frame.rows.find(value => value.handle === call.handle);
  const held = call.source?.rows.find(value => value.handle === call.handle);
  const global = frame.baseline?.frame.rows.find(value => value.handle === call.handle);
  if (!current || !held || !global) return false;
  const now = unpackWords(current.words), actual = unpackWords(held.words), substituted = unpackWords(global.words);
  return now.some((word, index) => (word === actual[index]) !== (word === substituted[index]));
}
check('global baseline substitution and changed due decisions refuse before a timing consumer', async () => {
  const session = await read('walking');
  const frame = session.frames.find(row => row.rowFromCalls.some(call => {
    return changesMask(row, call) && row.dueCalls.some(due => due.handle === call.handle && due.value);
  }));
  assert.ok(frame);
  const call = frame.rowFromCalls.find(row => changesMask(frame, row)
    && frame.dueCalls.some(due => due.handle === row.handle && due.value)); assert.ok(call);
  const wrong = structuredClone(frame);
  for (const row of wrong.rowFromCalls) if (row.handle === call.handle) row.source = wrong.baseline.frame;
  assert.throws(() => prepareFrame(wrong), /Prepared frame differs/);
  const delayed = structuredClone(frame);
  for (const due of delayed.dueCalls) if (due.handle === call.handle) due.value = false;
  assert.throws(() => prepareFrame(delayed), /Prepared frame differs/);
});
