/* oxlint-disable id-length, max-lines, typescript/prefer-readonly-parameter-types -- x, y and z are the schema's own field names, and the fuzz builds and mutates its own pages in one file */
import { expect, test } from 'vitest'

import {
  parseWorldScenePlacementPageText,
  plainPlacementPage,
} from './placement-page-text.ts'
import { parseWorldScenePlacementPage } from './worldScenePlacement.ts'

// MG10 / EM17: the text path admits a plain, exact page as it stands and sends
// everything else to the schema. What matters for safety: it never admits a
// page the schema refuses, and what it admits equals the schema's output. A
// seeded fuzz of valid pages and their mutations checks both against the schema.

type Random = () => number
type Bag = Record<string, unknown>
type Holder = Bag | unknown[]

const NEG0 = '@@neg0@@'
const INF = '@@inf@@'
const PROTO = '@@proto@@'
/** JSON text with what JSON.stringify cannot write: -0, an overflowing literal, an own `__proto__` key. */
const text = (value: unknown): string =>
  JSON.stringify(value)
    .replaceAll(`"${NEG0}"`, '-0')
    .replaceAll(`"${INF}"`, '1e999')
    .replaceAll(`"${PROTO}"`, '"__proto__"')
// Park and Miller's minimal standard generator: seeded, no bit operations.
function seeded(seed: number): Random {
  let state = seed
  return (): number => {
    state = (state * 48_271) % 2_147_483_647
    return state / 2_147_483_647
  }
}
const pick = <Item>(random: Random, list: readonly Item[]): Item | undefined =>
  list[Math.floor(random() * list.length)]
const chance = (random: Random, odds: number): boolean => random() < odds
const num = (random: Random, low = -1000, high = 1000): number =>
  Math.round((low + random() * (high - low)) * 1000) / 1000 || 0
const count = (random: Random, most: number): number =>
  Math.floor(random() * most)
const many = <Item>(
  length: number,
  make: (unused: unknown, index: number) => Item,
): Item[] => Array.from({ length }, make)
// oxlint-disable-next-line unicorn/no-null -- JSON's null is a value a page may carry
const LEAVES: readonly unknown[] = ['a', '', '福德祠', true, false, null]
function json(random: Random, depth: number): unknown {
  const kind = random()
  if (depth > 2 || kind < 0.5) {
    return chance(random, 0.5) ? num(random) : pick(random, LEAVES)
  }
  if (kind < 0.75) {
    return many(count(random, 4), (): unknown => json(random, depth + 1))
  }
  return Object.fromEntries(
    many(count(random, 4), (): [string, unknown] => [
      `k${String(random())}`,
      json(random, depth + 1),
    ]),
  )
}
const set =
  (bag: Bag, random: Random, odds: number): ((entries: Bag) => Bag) =>
  (entries: Bag): Bag => {
    for (const [key, value] of Object.entries(entries)) {
      if (chance(random, odds)) {
        bag[key] = value
      }
    }
    return bag
  }
function pose(random: Random): Bag {
  const out = set(
    { x: num(random), y: num(random), z: num(random) },
    random,
    0.3,
  )({
    color: [num(random, 0, 1), num(random, 0, 1), num(random, 0, 1)],
    params: {
      nested: json(random, 1),
      size: num(random, 0, 1),
      style: 'plaque',
    },
    variant: pick(random, ['plaque', 'a', 'stall-2']),
  })
  if (chance(random, 0.5)) {
    out['matrix'] = many(16, (): number => num(random, -2, 2))
    return out
  }
  out['yxz'] = set(
    { scale: num(random, 0.1, 3), yaw: num(random, -3, 3) },
    random,
    0.3,
  )({
    pitch: num(random, -1, 1),
    roll: num(random, -1, 1),
    yawAtan2: [num(random, -1, 1), num(random, -1, 1)],
  })
  return out
}
const tierNumber = (random: Random): unknown =>
  chance(random, 0.5)
    ? num(random, 0, 500)
    : { desktop: num(random, 0, 600), phone: num(random, 0, 300) }
const cull = (random: Random): Bag =>
  set(
    {},
    random,
    0.4,
  )({
    bounds: 'box',
    far: tierNumber(random),
    flat: true,
    from: 'bounds',
    frustum: false,
    keepNear: num(random),
    lodBy: 'set',
    minAngular: tierNumber(random),
    radiusBias: num(random),
    step: 2,
    view: 'forest',
  })
const floor = (random: Random): Bag =>
  set(
    {
      hd: num(random, 0, 9),
      hw: num(random, 0, 9),
      x: num(random),
      y: num(random),
      z: num(random),
    },
    random,
    0.3,
  )({
    profile: [
      [0, 1, 0],
      [1, 2, 0.5],
      [3, 0, 1],
    ],
    rot: num(random, -3, 3),
    slope: num(random, -1, 1),
    tilt: num(random, -1, 1),
  })
const piece = (random: Random): Bag =>
  set(
    { id: 'piece-a' },
    random,
    0.4,
  )({
    floorPolicy: pick(random, ['first', 'highest']),
    floors: many(1 + count(random, 2), (): Bag => floor(random)),
    follows: 'copy',
    name: 'p',
    solidFloor: true,
    split: 1 + count(random, 2047),
  })
const row = (random: Random, index: number): Bag =>
  set(
    {
      draw: pick(random, ['single', 'instanced', 'batched', 'merged']),
      id: `row-${String(index)}`,
      model: pick(random, ['galleryPlant', 'wall']),
      poses: many(count(random, 6), (): Bag => pose(random)),
    },
    random,
    0.3,
  )({
    batch: 'batch-a',
    colliders: many(count(random, 3), (): unknown => json(random, 1)),
    cull: cull(random),
    drawnInto: {
      boxes: many(6 * count(random, 3), (): number => num(random)),
      part: 'slab',
    },
    name: 'drawn',
    piece: piece(random),
    sortObjects: chance(random, 0.5),
    tier: pick(random, ['phone', 'desktop']),
  })
const page = (random: Random): Bag => ({
  rows: many(
    chance(random, 0.4) ? 1 : 1 + count(random, 4),
    (_: unknown, index: number): Bag => row(random, index),
  ),
  version: 1,
})

/** Every container in `value`, for a mutation to pick from. */
const isBag = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
function holders(value: unknown, out: Holder[] = []): Holder[] {
  if (Array.isArray(value) || isBag(value)) {
    out.push(value)
    for (const child of Object.values(value)) {
      holders(child, out)
    }
  }
  return out
}
const deep = (depth: number): unknown =>
  depth === 0 ? 1 : { deeper: deep(depth - 1) }
const REPLACEMENTS: readonly (() => unknown)[] = [
  (): unknown => NEG0,
  (): unknown => INF,
  (): unknown => 1e7,
  (): unknown => -1,
  (): unknown => 0.5,
  (): unknown => 3000,
  (): unknown => '',
  (): unknown => 'x'.repeat(257),
  (): unknown => 'forest',
  (): unknown => 'phone',
  (): unknown => true,
  (): unknown => JSON.parse('null'),
  (): unknown => [],
  (): unknown => ({}),
  (): unknown => [1, 2, 3],
  (): unknown => [1, 2, 3, 4],
  (): unknown => many(16, (): number => 0),
  (): unknown => deep(70),
  (): unknown => ({ phone: 1 }),
  (): unknown => ({ desktop: 2, phone: 1 }),
  (): unknown => [
    [0, 0, 0],
    [0, 0, 0],
  ],
  (): unknown => ({ scale: 1, yaw: 0 }),
]
const replacement = (random: Random): unknown => pick(random, REPLACEMENTS)?.()
function mutateList(list: unknown[], random: Random): void {
  const choice = random()
  if (choice < 0.25) {
    list.push(list.length > 0 ? structuredClone(list[0]) : 0)
  } else if (choice < 0.4) {
    list.pop()
  } else if (list.length > 0) {
    list[count(random, list.length)] = replacement(random)
  }
}
const KEYS = ['zz', PROTO, 'constructor', 'matrix', 'yxz', 'rows', 'id']
function mutateBag(bag: Bag, random: Random, rows: unknown): void {
  const choice = random()
  const key = pick(random, Object.keys(bag))
  if (choice < 0.1) {
    const list: readonly unknown[] = Array.isArray(rows) ? rows : []
    const [first, second] = list
    if (
      typeof first === 'object' &&
      first !== null &&
      typeof second === 'object' &&
      second !== null
    ) {
      Reflect.set(second, 'id', Reflect.get(first, 'id'))
    }
  } else if (choice < 0.3 || key === undefined) {
    bag[pick(random, KEYS) ?? 'zz'] = replacement(random)
  } else if (choice < 0.5) {
    Reflect.deleteProperty(bag, key)
  } else {
    bag[key] = choice < 0.6 ? [bag[key]] : replacement(random)
  }
}
function mutate(value: Bag, random: Random): void {
  const holder = pick(random, holders(value)) ?? value
  if (Array.isArray(holder)) {
    mutateList(holder, random)
  } else {
    mutateBag(holder, random, value['rows'])
  }
}
function schema(source: string): { ok: boolean; page?: unknown } {
  try {
    return { ok: true, page: parseWorldScenePlacementPage(JSON.parse(source)) }
  } catch {
    return { ok: false }
  }
}
/** The text path agrees with the schema on `source`; true when it took the plain path. */
function agrees(source: string): boolean {
  const expected = schema(source)
  const fast = plainPlacementPage(JSON.parse(source))
  if (fast) {
    expect(expected.ok, source).toBe(true)
    expect(JSON.parse(source)).toEqual(expected.page)
  }
  if (expected.ok) {
    expect(parseWorldScenePlacementPageText(source)).toEqual(expected.page)
  } else {
    expect(
      (): unknown => parseWorldScenePlacementPageText(source),
      source,
    ).toThrow()
  }
  return fast
}

/** Mutated pages, each checked by `agrees`: how many took the plain path, how many the schema refused. */
function fuzz(
  random: Random,
  rounds: number,
): { fast: number; refused: number } {
  const tally = { fast: 0, refused: 0 }
  for (let round = 0; round < rounds; round += 1) {
    const value = page(random)
    mutate(value, random)
    if (chance(random, 0.3)) {
      mutate(value, random)
    }
    const source = text(value)
    tally.fast += agrees(source) ? 1 : 0
    tally.refused += schema(source).ok ? 0 : 1
  }
  return tally
}

test('every generated valid page is admitted as it stands, equal to the schema output', (): void => {
  const random = seeded(410)
  for (let round = 0; round < 400; round += 1) {
    const source = text(page(random))
    expect(agrees(source)).toBe(true)
  }
})

test('the text path never admits what the schema refuses (a seeded fuzz of mutations)', (): void => {
  // PLACEMENT_FUZZ=<rounds>:<seed> runs a longer fuzz by hand
  const [rounds = 6000, seed = 1017] = (process.env['PLACEMENT_FUZZ'] ?? '')
    .split(':')
    .filter(Boolean)
    .map(Number)
  const tally = fuzz(seeded(seed), rounds)
  // The fuzz reaches both sides: plenty of refusals, and mutations the plain path still takes
  expect(tally.refused).toBeGreaterThan(rounds / 3)
  expect(tally.fast).toBeGreaterThan(rounds / 20)
}, 120_000)

test('shapes the schema rebuilds go through it: an array for an object, a long tuple, a dropped record key', (): void => {
  const yxz = { scale: 1, yaw: 0 }
  const base = {
    draw: 'single',
    id: 'r',
    model: 'm',
    poses: [{ x: 0, y: 0, yxz, z: 0 }],
  }
  for (const changed of [
    { ...base, cull: [] },
    { ...base, poses: [{ color: [1, 1, 1, 1], x: 0, y: 0, yxz, z: 0 }] },
    {
      ...base,
      poses: [{ params: { [PROTO]: 1, size: 2 }, x: 0, y: 0, yxz, z: 0 }],
    },
  ]) {
    const source = text({ rows: [changed], version: 1 })
    expect(plainPlacementPage(JSON.parse(source))).toBe(false)
    agrees(source)
  }
})

test('the JSON guard keeps its bounds: many rows over 100,000 values refuse, one row counts per pose', (): void => {
  const poses = many(6000, (): Bag => ({
    matrix: many(16, (): number => 0),
    x: 0,
    y: 0,
    z: 0,
  }))
  const one = { draw: 'instanced', id: 'a', model: 'm', poses }
  expect(agrees(text({ rows: [one], version: 1 }))).toBe(true)
  const two = text({
    rows: [one, { draw: 'single', id: 'b', model: 'm', poses: [] }],
    version: 1,
  })
  expect(schema(two).ok).toBe(false)
  expect(agrees(two)).toBe(false)
  for (const bad of [NEG0, INF]) {
    const odd = {
      draw: 'single',
      id: 'a',
      model: 'm',
      poses: [{ x: bad, y: 0, yxz: { scale: 1, yaw: 0 }, z: 0 }],
    }
    expect(agrees(text({ rows: [odd], version: 1 }))).toBe(false)
  }
})

test('the text path refuses text that is not JSON', (): void => {
  expect((): unknown =>
    parseWorldScenePlacementPageText('{"version":1,'),
  ).toThrow()
})
