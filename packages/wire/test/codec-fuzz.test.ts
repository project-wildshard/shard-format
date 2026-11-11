import assert from 'node:assert/strict'
import { test } from 'node:test'

import FIXTURES from '../fixtures/v1-examples.json' with { type: 'json' }
import { WireDecodeError } from '../src/wire-error.ts'
import { readExample } from './helpers/examples.ts'

// WR3's Opus review (J206): a seeded fuzz over every frozen v1 example shows
// untrusted bytes only ever raise WireDecodeError, never anything else.

/** A small seeded generator, so a failure replays. */
function seeded(seed: number): () => number {
  let state = seed
  return (): number => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

/** Overwrite one to four bytes, and sometimes cut the message short. */
function mutate(
  source: Readonly<Uint8Array>,
  random: () => number,
): Uint8Array {
  const bytes = Uint8Array.from(source)
  const flips = 1 + Math.floor(random() * 4)
  for (let flip = 0; flip < flips && bytes.length > 0; flip += 1) {
    bytes[Math.floor(random() * bytes.length)] = Math.floor(random() * 256)
  }
  return random() < 0.2
    ? bytes.subarray(0, Math.floor(random() * bytes.length))
    : bytes
}

/** One read: true when refused, and any other throw fails the test. */
function refusedRead(name: string, bytes: Readonly<Uint8Array>): boolean {
  try {
    readExample(name, bytes)
    return false
  } catch (error) {
    assert.ok(error instanceof WireDecodeError, `${name}: ${String(error)}`)
    return true
  }
}

test('mutated examples only ever raise WireDecodeError', (): void => {
  const random = seeded(20_261_111)
  let refused = 0
  for (const example of FIXTURES.examples) {
    const source = Uint8Array.from(Buffer.from(example.hex, 'hex'))
    for (let round = 0; round < 300; round += 1) {
      refused += refusedRead(example.name, mutate(source, random)) ? 1 : 0
    }
  }
  assert.ok(refused > 100)
})
