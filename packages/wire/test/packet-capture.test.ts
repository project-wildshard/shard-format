import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bytesText } from '../bench/capture/frame-data.ts'
import { capturePacket, preparePacket } from '../bench/capture/packet-replay.ts'
import GOLDENS from '../fixtures/v0.json' with { type: 'json' }
import { BitWriter } from '../frozen/v0/bits.ts'
import { encodeCommands } from '../frozen/v0/command.ts'
import { encodeHello, encodeAct, encodeEvents } from '../frozen/v0/messages.ts'

function mutateDecoded(value: unknown): void {
  assert.ok(value !== null && typeof value === 'object')
  Reflect.set(value, 'name', 'changed')
}

const packets = GOLDENS.fixtures.filter(
  (row: Readonly<{ stream: string }>): boolean => row.stream !== 'frame',
)
for (const fixture of packets) {
  test(
    `transport capture preserves real golden ${fixture.name}`,
    { timeout: 9500 },
    (): void => {
      const record = capturePacket(Buffer.from(fixture.hex, 'hex'))
      const text = JSON.stringify(record)
      const saved: unknown = JSON.parse(text)
      assert.deepEqual(saved, record)
      const prepared = preparePacket(saved)
      assert.equal(prepared.stream, fixture.stream)
      assert.equal(Buffer.from(prepared.encode()).toString('hex'), fixture.hex)
      assert.notEqual(prepared.decode(), undefined)
    },
  )
}

test('all five non-frame streams are represented', (): void => {
  assert.deepEqual(
    [
      ...new Set(
        packets.map((row: Readonly<{ stream: string }>): string => row.stream),
      ),
    ].toSorted(),
    ['act', 'commands', 'events', 'hello', 'welcome'],
  )
})

test('arbitrary command handles survive capture without fixture identities', (): void => {
  const bytes = encodeCommands(
    new BitWriter(),
    {
      ackFrame: 13,
      commands: [
        {
          seq: 3,
          viewTick: 12,
          steer: { keyX: 0, keyY: 1, stickX: -1, stickY: 0 },
          yaw: 1,
          pitch: 0,
          buttons: 0x1_04,
          heavyTarget: 'real-target',
          lockTarget: 'real-player',
          hookTarget: 65_534,
        },
      ],
    },
    (id): number => (id === 'real-target' ? 61_439 : 49_151),
  )
  const record = capturePacket(new Uint8Array(bytes))
  assert.deepEqual(
    new Uint8Array(preparePacket(record).encode()),
    new Uint8Array(bytes),
  )
})

test('a malformed stream or frame cannot bypass its capture oracle', (): void => {
  for (const fixture of GOLDENS.malformed) {
    assert.throws((): unknown => capturePacket(Buffer.from(fixture.hex, 'hex')))
  }
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array([5]),
    new Uint8Array([255]),
  ]) {
    assert.throws((): unknown => capturePacket(bytes))
  }
})

test('valid encoder text preserves BOM bytes across every text-bearing stream', (): void => {
  const bomPackets = [
    encodeHello(new BitWriter(), {
      schemaHash: 3_951_578_209,
      build: '\uFEFFbuild',
      player: '\uFEFFplayer',
      name: '\uFEFFRay',
      ledger: 0,
    }),
    encodeAct(new BitWriter(), {
      kind: 'chat',
      seq: 1,
      channel: 'room',
      text: '\uFEFFchat',
    }),
    encodeEvents(
      new BitWriter(),
      7,
      [
        { kind: 'view', tick: 7, name: '\uFEFFview', args: [1] },
        { kind: 'phase', tick: 7, flag: '\uFEFFflag', on: true },
      ],
      (): undefined => undefined,
    ),
  ]
  for (const bytes of bomPackets) {
    const record = capturePacket(new Uint8Array(bytes))
    assert.deepEqual(
      new Uint8Array(preparePacket(record).encode()),
      new Uint8Array(bytes),
    )
  }
})

test('noncanonical padding fails the byte oracle at capture and persisted read', (): void => {
  const bytes = Buffer.from('03000109000001', 'hex')
  assert.throws(
    (): unknown => capturePacket(bytes),
    /replay differs from real bytes/u,
  )
  assert.throws(
    (): unknown => preparePacket({ bytes: bytesText(bytes) }),
    /replay differs from real bytes/u,
  )
})

test('caller buffers and decoded results cannot mutate later replay', (): void => {
  const bytes = new Uint8Array(
    encodeHello(new BitWriter(), {
      schemaHash: 3_951_578_209,
      build: 'build',
      player: 'player',
      name: 'Ray',
      ledger: 0,
    }),
  )
  const expected = Uint8Array.from(bytes)
  const prepared = preparePacket(capturePacket(bytes))
  bytes.fill(0)
  mutateDecoded(prepared.decode())
  const encoded = new Uint8Array(prepared.encode())
  encoded.fill(0)
  assert.deepEqual(new Uint8Array(prepared.encode()), expected)
  assert.deepEqual(prepared.decode(), {
    schemaHash: 3_951_578_209,
    build: 'build',
    player: 'player',
    name: 'Ray',
    ledger: 0,
  })
})
