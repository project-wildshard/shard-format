// oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures, only read
import { expect, test } from 'vitest'

import { PLATFORM_DATA_SECTIONS } from './platformDataSections.ts'
import { ACCEPTED_SECTION_VERSIONS } from './section-versions.ts'
import { parseVehicles, vehicleRules } from './vehicles.ts'

import type {
  VehicleDock,
  VehicleKind,
  VehicleSeat,
  Vehicles,
} from './vehicles.ts'

// MIRROR-SALT-ZONE MSZ1 (meta): `world/vehicles` declares vehicle kinds and docks, one way (J364, J459 call 1 A).
const driver: VehicleSeat = {
  role: 'driver',
  at: [-0.4, 0.6, 0.2],
  pose: 'sit',
  leave: [-1.8, 0, 0.2],
}
const passenger: VehicleSeat = {
  role: 'passenger',
  at: [0.4, 0.6, 0.2],
  pose: 'sit',
  leave: [1.8, 0, 0.2],
}
const buggy: VehicleKind = {
  id: 'salt.buggy',
  panel: 'salt.buggy',
  labels: {
    drive: 'Drive the buggy',
    ride: 'Ride in the buggy',
    leave: 'Get out',
  },
  seats: [driver, passenger],
  hull: [{ at: [0, 0.5, 0], half: [0.9, 0.5, 1.6] }],
  handling: {
    speed: 22,
    reverse: 6,
    accel: 9,
    brake: 18,
    turn: 1.6,
    grip: 0.8,
    drift: 0.4,
    boost: 1.4,
    mass: 600,
    ground: true,
  },
  health: 300,
  sounds: {
    loop: 'buggy.engine',
    skid: 'buggy.skid',
    impact: 'buggy.hit',
    horn: 'buggy.horn',
  },
}
const sail: VehicleKind = {
  id: 'salt.land-sail',
  panel: 'salt.land-sail',
  seats: [
    { role: 'driver', at: [0, 0.8, 0], pose: 'stand', leave: [2.8, 0, 0] },
  ],
  hull: [{ at: [0, 0.79, 0.5], half: [0.6, 0.125, 1.8], yaw: 0.05 }],
  handling: {
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
  },
}
const yardBuggy: VehicleDock = {
  id: 'yard.buggy',
  kind: 'salt.buggy',
  at: [-10, 0, 150],
  yaw: 0,
  per: 'player',
  respawn: 60,
}
const yardSail: VehicleDock = {
  id: 'yard.sail',
  kind: 'salt.land-sail',
  at: [1, -0.09, 146.5],
  yaw: -0.05,
  per: 'shared',
  respawn: 20,
}
const fixture: Vehicles = { kinds: [buggy, sail], docks: [yardBuggy, yardSail] }
const references = {
  props: { panels: [{ id: 'salt.buggy' }, { id: 'salt.land-sail' }] },
  audio: {
    cues: ['buggy.engine', 'buggy.skid', 'buggy.hit', 'buggy.horn'].map(
      (cue: string): { id: string } => ({ id: cue }),
    ),
  },
  movers: [],
}

/** The fixture with its buggy changed. */
function withBuggy(change: Readonly<Partial<VehicleKind>>): Vehicles {
  return { ...fixture, kinds: [{ ...buggy, ...change }, sail] }
}
/** The buggy with its handling changed. */
function handling(
  change: Readonly<Partial<VehicleKind['handling']>>,
): Vehicles {
  return withBuggy({ handling: { ...buggy.handling, ...change } })
}
/** `count` copies of a row, each with its own id. */
function copies<Row extends { id: string }>(
  row: Readonly<Row>,
  count: number,
): Row[] {
  return Array.from(
    { length: count },
    (_unused: unknown, index: number): Row => ({
      ...row,
      id: `copy.${String(index)}`,
    }),
  )
}

test('a two-kind section round-trips byte for byte and is a platform section at version 1', (): void => {
  const parsed = parseVehicles(fixture)
  const written = JSON.stringify(parsed)
  expect(written).toBe(JSON.stringify(fixture))
  expect(parseVehicles(JSON.parse(written))).toEqual(parsed)
  expect(Object.hasOwn(PLATFORM_DATA_SECTIONS, 'world/vehicles')).toBe(true)
  expect(ACCEPTED_SECTION_VERSIONS['world/vehicles']).toEqual([1])
  expect(vehicleRules(parsed, references)).toEqual([])
})

test('a player dock can require a quest flag, but a shared dock cannot', (): void => {
  const locked: VehicleDock = {
    ...yardBuggy,
    requiresFlag: 'mirror.pennants.earned',
  }
  expect(parseVehicles({ ...fixture, docks: [locked] }).docks).toEqual([locked])
  expect((): Vehicles =>
    parseVehicles({ ...fixture, docks: [{ ...locked, per: 'shared' }] }),
  ).toThrow(/only a player dock/u)
})

test('vehicle surface grip admits a flood and a road in cell coordinates', (): void => {
  const surfaceGrip: NonNullable<Vehicles['surfaceGrip']> = {
    base: 0.8,
    patches: [
      { shape: 'circle', at: [0, 0], radius: 178, grip: 0.35 },
      {
        shape: 'road',
        line: [
          [0, 0],
          [0, 200],
        ],
        width: 8,
        grip: 1,
      },
    ],
  }
  expect(parseVehicles({ ...fixture, surfaceGrip }).surfaceGrip).toEqual(
    surfaceGrip,
  )
  expect((): Vehicles =>
    parseVehicles({ ...fixture, surfaceGrip: { ...surfaceGrip, base: 1.1 } }),
  ).toThrow()
  expect((): Vehicles =>
    parseVehicles({
      ...fixture,
      surfaceGrip: {
        ...surfaceGrip,
        patches: [{ shape: 'road', line: [[0, 0]], width: 0, grip: 1 }],
      },
    }),
  ).toThrow()
})

const refusals: readonly (readonly [string, unknown, string])[] = [
  [
    'a duplicate kind id',
    { ...fixture, kinds: [buggy, buggy, sail] },
    'vehicle kind ids are unique',
  ],
  [
    'a duplicate dock id',
    { ...fixture, docks: [yardBuggy, yardBuggy] },
    'vehicle dock ids are unique',
  ],
  [
    'a dock of no kind',
    { ...fixture, docks: [{ ...yardBuggy, kind: 'salt.tank' }] },
    'a vehicle dock names a declared kind',
  ],
  [
    'two driver seats',
    withBuggy({ seats: [driver, driver] }),
    'a vehicle kind has exactly one driver seat',
  ],
  [
    'no driver seat',
    withBuggy({ seats: [passenger] }),
    'a vehicle kind has exactly one driver seat',
  ],
  ['no seat', withBuggy({ seats: [] }), 'a vehicle kind has at least one seat'],
  [
    'five seats',
    withBuggy({ seats: [driver, passenger, passenger, passenger, passenger] }),
    'a vehicle kind has at most 4 seats',
  ],
  [
    'a hull box over 8 m',
    withBuggy({ hull: [{ at: [0, 0, 0], half: [1, 1, 8.5] }] }),
    'Invalid value: Expected <=8',
  ],
  [
    '17 hull boxes',
    withBuggy({
      hull: Array.from({ length: 17 }, (): VehicleKind['hull'][number] => ({
        at: [0, 0, 0],
        half: [1, 1, 1],
      })),
    }),
    'a vehicle hull has at most 16 boxes',
  ],
  [
    'a dock outside the cell',
    { ...fixture, docks: [{ ...yardBuggy, at: [251, 0, 0] }] },
    'Invalid value: Expected <=250',
  ],
  [
    'a top speed over 60 m/s',
    handling({ speed: 61 }),
    'Invalid value: Expected <=60',
  ],
  [
    'a reverse faster than the top speed',
    handling({ reverse: 23 }),
    'a vehicle reverses no faster than its top speed',
  ],
  ['a grip over 1', handling({ grip: 1.5 }), 'Invalid value: Expected <=1'],
  ['a boost over 4', handling({ boost: 5 }), 'Invalid value: Expected <=4'],
  [
    'a windless sail push',
    handling({ wind: { toward: [0, 0], push: 4 } }),
    'a wind push needs a direction',
  ],
  [
    'nine kinds',
    { kinds: copies(sail, 9), docks: [] },
    'a shard has at most 8 vehicle kinds',
  ],
  [
    '33 docks',
    { ...fixture, docks: copies(yardSail, 33) },
    'a shard has at most 32 vehicle docks',
  ],
  [
    'an unknown field',
    { ...fixture, kinds: [{ ...buggy, wheels: 4 }, sail] },
    'Invalid key',
  ],
]

test.each(refusals)(
  'refuses %s with its message',
  (_name: string, input: unknown, message: string): void => {
    expect((): Vehicles => parseVehicles(input)).toThrow(message)
  },
)

test("a kind's panel and sounds resolve, and a dock never takes a mover's id", (): void => {
  const parsed = parseVehicles(fixture)
  const thin = {
    props: { panels: [{ id: 'salt.buggy' }] },
    audio: { cues: [{ id: 'buggy.engine' }] },
    movers: [{ id: 'yard.sail' }],
  }
  expect(vehicleRules(parsed, thin)).toEqual([
    "vehicle kind salt.buggy's skid sound buggy.skid is not a declared audio cue",
    "vehicle kind salt.buggy's impact sound buggy.hit is not a declared audio cue",
    "vehicle kind salt.buggy's horn sound buggy.horn is not a declared audio cue",
    'vehicle kind salt.land-sail names the panel salt.land-sail, which props.panels does not declare',
    "vehicle dock yard.sail has a mover's id",
  ])
})
