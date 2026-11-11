import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HEAD, releasedCodec, releasedRef } from './helpers/cross-codec.ts'
import { recordProblems } from './helpers/cross-records.ts'
import { frameProblems } from './helpers/cross-session.ts'

import type { Codec } from './helpers/cross-codec.ts'

// WIRE-STABILITY WR6 (7): the cross-version harness. The codec at the last
// wire release (a scratch ref until `wire-v1.0.0`; WIRE_CROSS_REF overrides)
// beside HEAD's, both ways: hello and welcome with each side's tables, cmds
// and an act, thirty frames with skew (a field and a class the client
// lacks), a lost ack and a whole frame, and events with a spawn of the
// unknown class and a record no version knows. The two negative tests are
// the reverts it exists to catch: WR4's raw baselines and WR3's skip.

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a codec is a set of module namespaces
const session = (room: Codec, client: Codec): readonly string[] => [
  ...frameProblems({ room, client, projectedBaseline: false }),
  ...recordProblems({
    room,
    client,
    projectedBaseline: false,
    strictEvents: false,
  }),
]

test('the released client plays a HEAD room, and a HEAD client the released room', async (): Promise<void> => {
  const released = await releasedCodec(await releasedRef())
  assert.deepEqual(
    session(HEAD, released),
    [],
    `HEAD room, ${released.name} client`,
  )
  assert.deepEqual(
    session(released, HEAD),
    [],
    `${released.name} room, HEAD client`,
  )
})

test('a client that keeps projected rows as baselines goes red (the WR4 revert)', async (): Promise<void> => {
  const released = await releasedCodec(await releasedRef())
  assert.notDeepEqual(
    frameProblems({ room: HEAD, client: released, projectedBaseline: true }),
    [],
  )
})

test('a client that refuses unknown records goes red (the WR3 revert)', async (): Promise<void> => {
  const released = await releasedCodec(await releasedRef())
  assert.notDeepEqual(
    recordProblems({
      room: HEAD,
      client: released,
      projectedBaseline: false,
      strictEvents: true,
    }),
    [],
  )
})
