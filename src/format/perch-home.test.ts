import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'

interface SpawnFixture {
  readonly id: string
  readonly species: string
  readonly variant: string
  readonly brain: string
  readonly strike: string
  readonly seed: number
  readonly scale: number
  readonly at: readonly [number, number, number]
  readonly yaw: number
}

interface CreatureFixture {
  readonly brains: readonly Readonly<Record<string, unknown>>[]
  readonly groups: readonly unknown[]
  readonly spawns: readonly [SpawnFixture]
}

function fixture(alias = false): CreatureFixture {
  return {
    brains: [
      {
        id: 'fixture.brain',
        kind: alias ? 'guardian' : 'perch-hunter',
        thinkDivisor: 3,
        throwRadius: 18,
        throwDuration: 0.8,
        biteRadius: 2,
        biteDuration: 0.8,
        underRadius: 2,
        underSeconds: 0.5,
        holdRadius: 3,
        runSpeed: 3,
        activeGroundSeconds: 3,
        biteCooldown: 1,
        throwCooldownMin: 1,
        throwCooldownMax: 2,
        alertCue: 'alert',
        noticeCue: 'notice',
        ...(alias ? { pattern: 'perch' } : {}),
      },
    ],
    groups: [],
    spawns: [
      {
        id: 'fixture.actor',
        species: 'fixture.kind',
        variant: 'plain',
        brain: 'fixture.brain',
        strike: 'fixture.strike',
        seed: 9,
        scale: 1,
        at: [0, 0, 0],
        yaw: 0,
      },
    ],
  }
}

function refuses(input: unknown): void {
  expect((): void => {
    parse(CreaturesSchema, input)
  }).toThrow()
}

// These short keys are the existing public home schema, not local identifiers.
// oxlint-disable-next-line eslint/id-length
const home = { x: 2, y: 5, z: 3, r: 1 } as const

test.each([false, true])(
  'perch owner admits its finite home; alias=%s',
  (alias: boolean): void => {
    const source = fixture(alias)
    const input = {
      ...source,
      spawns: [{ ...source.spawns[0], home: { ...home } }],
    }
    const before = JSON.stringify(input)
    const parsed = parse(CreaturesSchema, input)
    expect(parsed.spawns[0]?.home).toEqual(home)
    expect(JSON.stringify(input)).toBe(before)
  },
)

test.each([false, true])(
  'omitted home preserves serialized bytes; alias=%s',
  (alias: boolean): void => {
    const source = fixture(alias)
    const parsed = parse(CreaturesSchema, source)
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(source))
    expect(Object.hasOwn(parsed.spawns[0] ?? {}, 'home')).toBe(false)
  },
)

const invalidHomes = [
  // oxlint-disable-next-line eslint/id-length
  { ...home, r: 0 },
  // oxlint-disable-next-line eslint/id-length
  { ...home, r: -1 },
  // oxlint-disable-next-line eslint/id-length
  { ...home, y: Number.NaN },
  { ...home, extra: true },
] as const
test.each(invalidHomes)(
  'malformed home still refuses: %j',
  (invalid: Readonly<Record<string, unknown>>): void => {
    const source = fixture()
    refuses({ ...source, spawns: [{ ...source.spawns[0], home: invalid }] })
  },
)

test('unresolved policies cannot claim per-body home authority', (): void => {
  const source = fixture()
  refuses({
    ...source,
    spawns: [{ ...source.spawns[0], brain: 'unknown', home }],
  })
  // Null is the public format's explicit no-controller declaration.
  // oxlint-disable-next-line unicorn/no-null
  refuses({ ...source, spawns: [{ ...source.spawns[0], brain: null, home }] })
})

const unsupportedPolicies = [
  {
    id: 'fixture.brain',
    kind: 'pursue',
    awareRadius: 14,
    leashRadius: 35,
    speed: 2,
    returnSpeed: 2,
    stopDistance: 1,
    turnRate: 3,
    thinkDivisor: 3,
    attackCooldownTicks: 60,
    wanderRadius: 3,
    wanderEveryTicks: 120,
  },
  {
    id: 'fixture.brain',
    kind: 'guardian',
    thinkDivisor: 3,
    wakeRadius: 14,
    guardRadius: 45,
    approachRadius: 30,
    swingRadius: 2,
    swingDuration: 0.8,
    speed: 3,
    holdRadius: 3,
    sideSpeed: 1,
    sideFlipSeconds: 1,
    sinkAfterSeconds: 1,
    cooldownSeconds: 1,
    hideOffset: -2.3,
    noticeCue: 'notice',
  },
] as const
test.each(unsupportedPolicies)(
  'unsupported valid policy refuses home: %j',
  (brain: Readonly<Record<string, unknown>>): void => {
    const source = { ...fixture(), brains: [brain] }
    expect((): void => {
      parse(CreaturesSchema, source)
    }).not.toThrow()
    refuses({ ...source, spawns: [{ ...source.spawns[0], home }] })
  },
)
