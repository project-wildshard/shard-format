// oxlint-disable typescript/prefer-readonly-parameter-types, max-statements, complexity, id-length, unicorn/no-null, typescript/no-unsafe-assignment, typescript/no-unsafe-type-assertion -- test fixtures, only read: a built shard's rows read from JSON, checked field by field
import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { parseMovers } from './movers.ts'
import {
  liftSteerVehicles,
  vehicleCarryHulls,
  vehicleCarryMovers,
} from './vehicle-lift.ts'
import { vehicleRules } from './vehicles.ts'

import type { LiftSource } from './vehicle-lift.ts'

// MIRROR-SALT-ZONE MSZ2 (meta): Mirror Salt's teal land-sail, a steer carry since SS-MS2a4, migrates to world/vehicles.
const REV4: LiftSource & { source: string } = JSON.parse(
  readFileSync(
    new URL('../test/fixtures/mirror-salt-rev4-sail.json', import.meta.url),
    'utf8',
  ),
)
const SAIL = 'salt.land-sail'

test("Mirror Salt rev 4's sail lifts to one kind and one shared dock, and leaves movers", (): void => {
  const { vehicles, movers, notes } = liftSteerVehicles(REV4)
  expect(movers).toEqual([])
  expect(notes).toEqual([])
  expect(vehicles.docks).toEqual([
    {
      id: SAIL,
      kind: SAIL,
      at: [0.955, -0.09, 146.5218],
      yaw: -0.05,
      per: 'shared',
      respawn: 30,
    },
  ])
  const [kind] = vehicles.kinds
  expect(kind?.panel).toBe(SAIL)
  expect(kind?.labels).toEqual({
    drive: 'Board the land-sail',
    leave: 'Leave the land-sail',
  })
  expect(kind?.seats).toEqual([
    { role: 'driver', at: [0, 0.8, 0], pose: 'stand', leave: [2.816, 0, 0] },
  ])
  expect(kind?.handling).toEqual({
    speed: 9,
    reverse: 0,
    accel: 4,
    brake: 4,
    turn: 1,
    grip: 1,
    drift: 0,
    boost: 1.6,
    mass: 250,
    ground: true,
    wind: { toward: [0.8, 0.6], push: 4 },
  })
  // The deck's world-space collider (1, 0.7, 147, yaw -0.05) in the sail's frame about its rest and heading.
  expect(kind?.hull).toEqual([
    { at: [0.069, 0.79, 0.475], half: [0.6, 0.125, 1.8] },
  ])
  expect(
    vehicleRules(vehicles, { props: REV4.props, audio: { cues: [] }, movers }),
  ).toEqual([])
})

test('the lifted sail lowers back to the steer carry it was, for an engine without the vehicle runtime', (): void => {
  const { vehicles } = liftSteerVehicles(REV4)
  const [original] = REV4.movers
  const [lowered] = parseMovers(vehicleCarryMovers(vehicles, 9101))
  expect(lowered?.id).toBe(original?.id)
  expect([lowered?.entity, lowered?.module, lowered?.input]).toEqual([
    original?.entity,
    original?.module,
    original?.input,
  ])
  expect([
    lowered?.at,
    lowered?.euler,
    lowered?.driver,
    lowered?.trigger,
  ]).toEqual([
    original?.at,
    original?.euler,
    original?.driver,
    original?.trigger,
  ])
  expect(lowered?.carry?.seat).toBe(original?.carry?.seat)
  expect(lowered?.carry?.landings).toEqual(original?.carry?.landings)
  expect(lowered?.carry?.prompts.map((prompt): string => prompt.label)).toEqual(
    original?.carry?.prompts.map((prompt): string => prompt.label),
  )
  const [box] = vehicleCarryHulls(vehicles).get(SAIL) ?? []
  expect([box?.x, box?.y, box?.z, box?.hz]).toEqual([0.069, 0.79, 0.475, 1.8])
})

test('a carry with no steer driver stays a mover, and a non-box collider is noted, not taken', (): void => {
  const [sail] = REV4.movers
  if (sail === undefined) {
    throw new Error('the fixture has its sail')
  }
  const winch = { ...sail, id: 'ferry', driver: { kind: 'static' as const } }
  const colliders = [
    ...(REV4.props?.colliders ?? []),
    {
      id: 'ball',
      panel: SAIL,
      initialActive: false,
      shapes: [{ kind: 'capsule', x: 1, y: 1, z: 147, radius: 0.5, half: 1 }],
    },
  ]
  const source = {
    movers: [sail, winch],
    props: REV4.props === null ? null : { ...REV4.props, colliders },
  } as unknown as LiftSource
  const { vehicles, movers, notes } = liftSteerVehicles(source)
  expect(movers.map((row): string => row.id)).toEqual(['ferry'])
  expect(vehicles.kinds.map((row): string => row.id)).toEqual([SAIL])
  expect(notes).toEqual([`${SAIL}: a capsule collider is no hull box`])
})
