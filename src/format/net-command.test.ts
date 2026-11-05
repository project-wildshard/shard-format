import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { NetActSchema, NetCommandSchema } from './netCommand.ts'

const steer = { keyX: 0, keyY: 0, stickX: 0, stickY: 0 }
const command = { buttons: 0, pitch: 0, seq: 1, steer, viewTick: 2, yaw: 0 }
const TOP = 65_535

test('buttons hold 16 bits, no more', (): void => {
  expect(parse(NetCommandSchema, { ...command, buttons: TOP }).buttons).toBe(
    TOP,
  )
  expect(
    safeParse(NetCommandSchema, { ...command, buttons: TOP + 1 }).success,
  ).toBe(false)
})

test('a command may name its lock-on target (J116)', (): void => {
  expect(
    parse(NetCommandSchema, { ...command, lockTarget: 'creature.1' })
      .lockTarget,
  ).toBe('creature.1')
  expect(
    safeParse(NetCommandSchema, { ...command, lockTarget: 'no spaces' })
      .success,
  ).toBe(false)
})

test('a command may name the hook a LOCK press picks', (): void => {
  expect(
    parse(NetCommandSchema, { ...command, hookTarget: 3 }).hookTarget,
  ).toBe(3)
  for (const hookTarget of [-1, 1.5, TOP + 1, Number.NaN]) {
    expect(
      safeParse(NetCommandSchema, { ...command, hookTarget }).success,
    ).toBe(false)
  }
})

test('equip and ride are acts', (): void => {
  const equip = { kind: 'equip', seq: 1, slot: 2 }
  const ride = { action: 'mount', kind: 'ride', seq: 1 }
  expect(parse(NetActSchema, equip)).toStrictEqual(equip)
  expect(parse(NetActSchema, ride)).toStrictEqual(ride)
  expect(safeParse(NetActSchema, { ...equip, slot: 32 }).success).toBe(false)
  expect(safeParse(NetActSchema, { ...ride, action: 'fly' }).success).toBe(
    false,
  )
})
