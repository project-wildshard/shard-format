import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'

const perch = {
  id: 'fixture.perch',
  sites: [{ at: [0, 5, 0], base: [0, 0, 0] }],
  program: {
    script: {
      id: 'fixture.projection',
      abi: '1.0',
      side: 'sim',
      module: `blobs/wasm/${'a'.repeat(64)}.wasm`,
      source: 'behaviour/perch.as',
      binding: { shard: true },
      onFail: 'hold',
      on: ['start'],
      reads: [],
      commands: [],
      stateVersion: 1,
      state: [],
      params: {},
    },
    bytes: 'AGFzbQEAAAA=',
  },
  policy: {
    kind: 'fixture.kind',
    strike: 'fixture.bite',
    sound: 'fixture.notice',
    sourceHeight: 0.95,
    targetHeight: 0.9,
    attackStream: 'ai',
    actions: {
      stateKey: 'st',
      states: [
        'perch',
        'ground-idle',
        'attack',
        'drop',
        'ground',
        'return',
        'climb',
      ],
      actions: [
        {
          state: 2,
          phase: 0.45,
          effect: 'bite',
          once: { key: 'hit', value: 1, test: 'falsy' },
          when: { key: 'bite', test: 'truthy' },
        },
        {
          state: 2,
          phase: 0.62,
          effect: 'throw',
          once: { key: 'hit', value: 1, test: 'falsy' },
          when: { key: 'bite', test: 'falsy' },
        },
      ],
    },
    score: 'perchScore',
    height: 'perchHeight',
    heightChannel: 'perchH',
    root: {
      drop: 'drop',
      velocity: 'vy',
      land: 'land',
      climb: 'climb',
      height: 'perchH',
      baseX: 'bx',
      baseZ: 'bz',
      // oxlint-disable-next-line eslint/id-length -- Existing native root protocol key.
      x: 'px',
      // oxlint-disable-next-line eslint/id-length -- Existing native root protocol key.
      z: 'pz',
      gravity: 9.8,
      speed: 2.2,
      landing: 0.35,
    },
  },
  projectile: {
    strike: 'fixture.throw',
    launch: {
      kind: 'target',
      speed: 8,
      time: [0.3, 2],
      gravity: 9.8,
      rotation: [0, 0, 0],
    },
    pool: {
      count: 16,
      clocks: 'f32',
      initial: 1,
      restSpeed: 0.15,
      restTime: 4,
      maxAge: 16,
      inclusive: false,
      body: {
        radius: 0.13,
        material: 'wood',
        density: 650,
        friction: 0.7,
        restitution: 0.35,
        angularDamping: 3,
        group: 'DEBRIS',
        ccd: true,
        expendable: true,
      },
      contact: { radius: 0.45, height: 1.75, horizontalBounce: -0.2, up: 1.5 },
    },
  },
} as const

function fixture(alias = false): Readonly<Record<string, unknown>> {
  return {
    perchBodies: [perch],
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
        strike: 'fixture.bite',
        seed: 9,
        scale: 1,
        at: [0, 0, 0],
        yaw: 0,
        // oxlint-disable-next-line eslint/id-length -- Existing public home coordinates.
        home: { x: 0, y: 0, z: 0, r: 45 },
        perchBody: 'fixture.perch',
      },
    ],
  }
}

function objectAt(input: unknown): object {
  if (input === null || typeof input !== 'object') {
    throw new Error('Invalid fixture path')
  }
  return input
}

function changed(path: readonly string[], value: unknown): unknown {
  const input = structuredClone(fixture())
  let parent: unknown = input
  for (const key of path.slice(0, -1)) {
    parent = Reflect.get(objectAt(parent), key)
  }
  const leaf = path.at(-1)
  if (leaf === undefined) {
    throw new Error('Invalid fixture leaf')
  }
  Reflect.set(objectAt(parent), leaf, value)
  return input
}

function refuses(input: unknown): void {
  expect((): void => {
    parse(CreaturesSchema, input)
  }).toThrow()
}

test.each([false, true])(
  'complete declared perch authority parses without mutation; alias=%s',
  (alias: boolean): void => {
    const input = fixture(alias)
    const before = JSON.stringify(input)
    const parsed = parse(CreaturesSchema, input)
    expect(parsed.perchBodies).toEqual([perch])
    expect(parsed.spawns[0]?.perchBody).toBe('fixture.perch')
    expect(JSON.stringify(input)).toBe(before)
  },
)

const malformed = [
  [['perchBodies'], undefined],
  [['perchBodies', '0', 'projectile'], {}],
  [['perchBodies', '0', 'policy'], {}],
  [['perchBodies', '0', 'program', 'bytes'], undefined],
  [['perchBodies', '0', 'sites'], []],
  [['perchBodies', '0', 'sites', '0', 'at', '1'], Number.NaN],
  [['perchBodies', '0', 'sites', '0', 'base', '0'], 251],
  [['perchBodies', '0', 'program'], {}],
  [['perchBodies', '0', 'program', 'script', 'side'], 'view'],
  [['perchBodies', '0', 'program', 'script', 'commands'], ['invented']],
  [['perchBodies', '0', 'policy', 'attackStream'], undefined],
  [['perchBodies', '0', 'policy', 'root', 'height'], 'foreign'],
  [['perchBodies', '0', 'policy', 'root', 'gravity'], -1],
  [['perchBodies', '0', 'policy', 'root', 'speed'], 0],
  [['perchBodies', '0', 'policy', 'root', 'landing'], -1],
  [
    ['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'effect'],
    'invented',
  ],
  [['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'state'], 3],
  [['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'phase'], 1.1],
  [
    ['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'once', 'key'],
    'foreign',
  ],
  [['perchBodies', '0', 'projectile', 'pool', 'count'], 129],
  [['perchBodies', '0', 'projectile', 'launch', 'speed'], 0],
  [
    ['perchBodies', '0', 'projectile', 'launch', 'time'],
    [2, 1],
  ],
  [['perchBodies', '0', 'projectile', 'strike'], ''],
  [['spawns', '0', 'perchBody'], 'missing'],
  [['spawns', '0', 'species'], 'foreign.kind'],
  [['spawns', '0', 'home'], undefined],
] as const

test.each(malformed)(
  'malformed or unresolved authority refuses: %j',
  (path: readonly string[], value: unknown): void => {
    refuses(changed(path, value))
  },
)

test('duplicate body catalogue identities refuse', (): void => {
  refuses({ ...fixture(), perchBodies: [perch, perch] })
})

test('the catalogue bounds the total physical pool across definitions', (): void => {
  const other = {
    ...perch,
    id: 'fixture.other',
    projectile: {
      ...perch.projectile,
      pool: { ...perch.projectile.pool, count: 128 },
    },
  }
  refuses({ ...fixture(), perchBodies: [perch, other] })
})

test('two declared actors select one shared physical pool', (): void => {
  const parsed = parse(CreaturesSchema, fixture())
  const [first] = parsed.spawns
  if (first === undefined) {
    throw new Error('Missing first fixture actor')
  }
  const troop = parse(CreaturesSchema, {
    ...fixture(),
    spawns: [first, { ...first, id: 'fixture.other' }],
  })
  expect(troop.spawns).toHaveLength(2)
  expect(troop.perchBodies).toHaveLength(1)
  expect(troop.perchBodies?.[0]?.projectile.pool.count).toBe(16)
})

test('duplicate occupied site identities refuse', (): void => {
  refuses(
    changed(['perchBodies', '0', 'sites'], [perch.sites[0], perch.sites[0]]),
  )
})
