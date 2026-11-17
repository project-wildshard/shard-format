import { expect, test } from 'vitest'

import { MOVER_DRIVER_MODULES, lowerMoverMotion } from './moverMotion.ts'
import { parseMovers } from './movers.ts'

// SHARD-SOURCE SS-MS2a1: a carry mover whose driver is `steer` moves by its rider's stick and boost, not a fixed path.
const steer = {
  kind: 'steer',
  speed: 9,
  turn: 1.2,
  boost: 1.6,
  accel: 4,
  ground: true,
} as const
// oxlint-disable-next-line id-length -- a rest pose's axes are x, y and z
const at = { x: 4, y: 0.5, z: -6 }
// oxlint-disable-next-line id-length -- a rest pose's axes are x, y and z
const euler = { x: 0, y: 0.25, z: 0 }
const trigger = { kind: 'interact', permission: 0 } as const
const carry = {
  seat: 0.9,
  landings: [
    [1.5, 0, 0],
    [-1.5, 0, 0],
  ],
  yaw: 0,
  surface: {
    level: 0,
    bankRamp: 0,
    bob: [0, 0],
    pitch: [0, 0],
    roll: [0, 0, 0],
  },
  prompts: [
    { at: [0, 0, 0], radius: 2.5, label: 'Board the land-sail' },
    { at: [0, 0, 0], radius: 2.5, label: 'Leave the land-sail' },
  ],
}
const row = (
  driver: object = steer,
  extra: object = {},
): Record<string, unknown> => {
  const lowered = lowerMoverMotion({ trigger, driver }, { at, euler })
  return {
    id: 'land-sail',
    entity: 7,
    module: lowered.module,
    execution: 'native',
    kind: 'channel',
    at,
    euler,
    enabled: true,
    boxes: [],
    trigger,
    driver,
    carry,
    input: lowered.input,
    ...extra,
  }
}

test('a steer driver lowers to its own native identity with its numbers and rest pose', (): void => {
  expect(lowerMoverMotion({ trigger, driver: steer }, { at, euler })).toEqual({
    module: MOVER_DRIVER_MODULES.steer,
    input: [9, 1.2, 1.6, 4, 1, 4, 0.5, -6, 0.25],
  })
  expect(
    Object.values(MOVER_DRIVER_MODULES).filter(
      (id): boolean => id === MOVER_DRIVER_MODULES.steer,
    ),
  ).toHaveLength(1)
})

test('a native carry channel admits a steer driver', (): void => {
  const [parsed] = parseMovers([row()])
  expect(parsed?.driver).toEqual(steer)
  expect(parsed?.carry).toEqual(carry)
})

test('a steer driver needs a native carry, a board press and no clip', (): void => {
  expect((): unknown => parseMovers([{ ...row(), carry: undefined }])).toThrow()
  expect((): unknown =>
    parseMovers([row(steer, { execution: undefined })]),
  ).toThrow()
  expect((): unknown =>
    lowerMoverMotion(
      { trigger: { kind: 'always' }, driver: steer },
      { at, euler },
    ),
  ).toThrow('Steer')
  const track = {
    clip: 'c',
    duration: 1,
    loop: 'once',
    speed: 1,
    times: [0, 1],
    position: [
      [0, 0, 0],
      [1, 0, 0],
    ],
  }
  expect((): unknown =>
    lowerMoverMotion({ trigger, driver: steer, track }, { at, euler }),
  ).toThrow('Steer')
})

test('steer numbers are bounded: top speed, turn rate, boost and acceleration', (): void => {
  for (const bad of [
    { speed: 0 },
    { speed: 61 },
    { turn: 0 },
    { turn: 7 },
    { boost: 0.5 },
    { boost: 5 },
    { accel: 0 },
    { extra: 1 },
  ]) {
    expect((): unknown =>
      lowerMoverMotion(
        { trigger, driver: { ...steer, ...bad } },
        { at, euler },
      ),
    ).toThrow()
  }
})
