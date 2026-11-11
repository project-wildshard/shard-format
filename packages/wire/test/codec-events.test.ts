import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  encodeEvents,
  eventsDecoder,
  eventTables,
} from '../src/event-stream.ts'
import { readRecords, writeRecord } from '../src/framing.ts'
import { bytesOf, eventsRecord, onlyRecord } from './helpers/codec.ts'

import type { WireEvent } from '../src/game.ts'

// WR3: every event form round-trips through an `events` record, and an event
// the receiver doesn't know is skipped while its neighbours apply.

/* oxlint-disable id-length -- world axes are x, y and z on the wire */
const AT = { x: 260, y: 260, z: -260 }
const DIR = { x: -1, y: 1, z: 1 }
/* oxlint-enable id-length */
const HIT = {
  event: 'hit',
  fields: {
    tick: 5,
    target: 3,
    amount: 12.5,
    at: AT,
    head: true,
    killed: false,
    blow: true,
    confirmFor: 4,
  },
}
const DIED = {
  event: 'died',
  fields: { tick: 5, id: 3, by: 0, dir: DIR, impulse: 2 },
}
const LEDGER = {
  event: 'ledger',
  fields: {
    tick: 2,
    serial: 8,
    id: 'g1',
    grant: 'item',
    name: 'gem',
    amount: 1,
    pending: true,
  },
}
const CHAT = {
  event: 'chat',
  fields: { tick: 2, line: 1, channel: 'room', from: 0, name: 'A', text: 'hi' },
}
/* oxlint-disable id-length -- `n` is the quest event's wire field */
const QUEST = { tick: 1, quest: 'q', started: true, step: undefined, n: 0 }
const QUEST_ON = { ...QUEST, started: false, step: '', n: 2 }
/* oxlint-enable id-length */
const CAUSE = { kind: 'boss', label: 'Boss', text: 'crushed' }
const DEATH = { tick: 4, id: 1, checkpoint: false, cause: CAUSE }
const EVENTS: readonly WireEvent[] = [
  { event: 'despawn', fields: { handle: 9 } },
  HIT,
  DIED,
  { event: 'quest', fields: QUEST },
  { event: 'quest', fields: QUEST_ON },
  { event: 'phase', fields: { tick: 1, flag: 'f', on: false } },
  { event: 'reward', fields: { tick: 2, coins: 10, body: 3, item: undefined } },
  { event: 'reward', fields: { tick: 2, coins: 0, body: 0, item: 'gem' } },
  { event: 'travel', fields: { tick: 2, from: 0, to: 4 } },
  LEDGER,
  CHAT,
  { event: 'mount', fields: { tick: 3, rider: 1, mount: 2, seq: 3 } },
  { event: 'dismount', fields: { tick: 3, rider: 1, mount: 2, seq: 0 } },
  { event: 'owned', fields: { tick: 3, name: 'coins', value: 0 } },
  { event: 'view', fields: { tick: 3, name: 'ring', args: [] } },
  { event: 'view', fields: { tick: 3, name: 'ring', args: [1, -0.5, 1e9] } },
  { event: 'player-died', fields: { ...DEATH, cause: undefined } },
  {
    event: 'player-died',
    fields: { ...DEATH, cause: { ...CAUSE, text: undefined } },
  },
  { event: 'player-died', fields: DEATH },
  { event: 'spawn', fields: { handle: 2, cls: 2, id: 'animal:1' } },
]

test('every event form round-trips through an events record', (): void => {
  const decode = eventsDecoder(eventTables())
  const bytes = encodeEvents(4_294_967_295, EVENTS)
  assert.deepEqual(decode(onlyRecord(bytes)), {
    tick: 4_294_967_295,
    events: EVENTS,
    skipped: [],
  })
})

/** The events record for `hit, died`, rebuilt with tag 40 between them. */
function withUnknown(): Uint8Array {
  const span = onlyRecord(encodeEvents(7, [HIT, DIED]))
  const tickEnd = span.start + 4
  const [hit, died] = readRecords(span.bytes, tickEnd, span.end)
  assert.ok(hit && died)
  const body = bytesOf(span, span.start, tickEnd)
  writeRecord(body, hit.tag, span.bytes.slice(hit.start, hit.end))
  writeRecord(body, 40, Uint8Array.of(1, 2, 3))
  writeRecord(body, died.tag, span.bytes.slice(died.start, died.end))
  return eventsRecord(body)
}

test('an unknown event between two known ones is skipped, and they apply', (): void => {
  const decode = eventsDecoder(eventTables())
  const span = onlyRecord(withUnknown())
  assert.deepEqual(decode(span), {
    tick: 7,
    events: [HIT, DIED],
    skipped: [40],
  })
})
