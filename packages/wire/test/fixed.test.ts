import assert from 'node:assert/strict'
import { test } from 'node:test'

import { quantiseCommand as frozenQuantise } from '../frozen/v0/command.ts'
import { quantiseCommand } from '../src/command.ts'
import { fixedCodec, STEER_AXIS_CODEC } from '../src/fixed.ts'

function command(value: number): {
  readonly steer: {
    readonly keyX: number
    readonly keyY: number
    readonly stickX: number
    readonly stickY: number
  }
  readonly yaw: number
  readonly pitch: number
} {
  return {
    steer: { keyX: value, keyY: value, stickX: value, stickY: value },
    yaw: 1,
    pitch: 0,
  }
}

function neighbors(value: number): readonly number[] {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const word = view.getBigUint64(0)
  const step = value > 0 ? 1n : -1n
  view.setBigUint64(0, word - step)
  const before = view.getFloat64(0)
  view.setBigUint64(0, word + step)
  return [before, value, view.getFloat64(0)]
}

test('all 256 axis bytes decode bit-exactly, including reserved byte zero', (): void => {
  for (let word = 0; word < 256; word += 1) {
    assert.equal(STEER_AXIS_CODEC.decode(word), (word - 127 - 1) / 127)
    const input = command((word - 127 - 1) / 127)
    assert.deepEqual(quantiseCommand(input), frozenQuantise(input))
  }
})

test('all half steps use the original integer multiply before round', (): void => {
  for (let step = -128; step < 128; step += 1) {
    for (const value of neighbors((step + 0.5) / 127)) {
      assert.equal(
        STEER_AXIS_CODEC.encode(value),
        Math.round(value * 127) + 127 + 1,
      )
      assert.deepEqual(
        quantiseCommand(command(value)),
        frozenQuantise(command(value)),
      )
    }
  }
})

test('reciprocal arithmetic is demonstrably a different codec', (): void => {
  let encodes = 0
  let decodes = 0
  for (let word = 0; word < 256; word += 1) {
    const value = (word - 128 + 0.5) / 127
    if (
      Math.round(value / (1 / 127)) + 128 !==
      STEER_AXIS_CODEC.encode(value)
    ) {
      encodes += 1
    }
    if ((word - 128) * (1 / 127) !== STEER_AXIS_CODEC.decode(word)) {
      decodes += 1
    }
  }
  assert.ok(encodes > 0)
  assert.ok(decodes > 0)
})

test('a reciprocal cannot be passed as an integer divisor', (): void => {
  assert.throws((): void => {
    fixedCodec(8, 1 / 127, -128)
  }, RangeError)
})
