import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { parseGrappleProfile } from './grapple.ts'
import { ModesSchema } from './modes.ts'
import { shardfileRules } from './shardSchema.ts'

import type { GrappleMode } from './modes.ts'
import type { Shardfile } from './shardSchema.ts'

// ONE-FORMAT OF41c: a plain `state/modes` grapple row carries what the native host read from its own files (a profile
// file, a hooks file and a guard owner), so the declared path can install the grapple with no native assembly. The
// row's own timings are the course's mode; a row without the new fields parses as it did.
const tool = {
  course: {
    name: 'Quarry',
    clearance: {
      axis: 'x',
      plane: 0,
      min: -4,
      max: 4,
      base: 0,
      top: 2,
      ceiling: 8,
      owners: ['quarry.rail'],
    },
  },
  cues: {
    fire: 'grapple.fire',
    bite: 'grapple.bite',
    zip: 'grapple.zip',
    reel: 'grapple.reel',
    dock: 'grapple.dock',
  },
  looks: {
    muzzle: 'q-muzzle',
    bite: 'q-bite',
    dock: 'q-dock',
    sparks: 'q-sparks',
    ribbon: 'q-ribbon',
  },
  fact: {
    name: 'quarry.crossed',
    entity: 'quarry.pit',
    source: 'quarry.crossing',
  },
  headless: {
    step: 'quarry.claw',
    lock: 'quarry.lock',
    aim: 'quarry.pitch',
    eye: 1.68,
    aspect: 1,
    portraitFov: 70,
  },
}
const hooks: unknown = JSON.parse(
  '[{"x":-4,"y":2,"z":0},{"x":10,"y":130,"z":-3}]',
)
const timings = {
  id: 'hook',
  minRange: 2.5,
  maxRange: 38,
  zipSpeed: 22,
  fireTime: 0.27,
  biteTime: 0.1,
  reelTime: 0.48,
  windowX: 0.52,
  windowY: 0.68,
}

function rows(grapple: readonly unknown[]): readonly GrappleMode[] | undefined {
  const parsed = safeParse(ModesSchema, { grapple })
  return parsed.success ? parsed.output.grapple : undefined
}
function issue(row: Readonly<Record<string, unknown>>): string | undefined {
  return safeParse(ModesSchema, { grapple: [{ id: 'hook', ...row }] })
    .issues?.[0]?.message
}

test('OF41c: a grapple mode with a profile and hooks parses, and with its timings is the native profile', (): void => {
  const row = rows([
    {
      id: 'quarry.claw',
      zipSpeed: 14,
      profile: tool,
      hooks,
      guard: 'quarry.rail',
      rise: true,
    },
  ])?.[0]
  if (row?.profile === undefined) {
    throw new Error('Missing grapple profile')
  }
  expect(row.hooks).toEqual(hooks)
  expect(row.guard).toBe('quarry.rail')
  expect(row.rise).toBe(true)
  const { profile, hooks: _hooks, guard: _guard, rise: _rise, ...mode } = row
  const native = parseGrappleProfile({
    ...profile,
    id: row.id,
    course: { ...profile.course, mode },
  })
  expect(native.course).toEqual({
    ...tool.course,
    mode: { ...timings, id: 'quarry.claw', zipSpeed: 14 },
  })
  expect(native.fact).toEqual(tool.fact)
})

test('OF41c: a grapple mode without the new fields parses byte-identical', (): void => {
  const parsed = rows([timings])
  expect(parsed).toEqual([timings])
  expect(JSON.stringify(parsed?.[0])).toBe(JSON.stringify(timings))
})

test('OF41c: a profile needs its hooks, hooks need a profile, and guard and rise need the profile', (): void => {
  expect(issue({ profile: tool })).toBe(
    'a grapple mode carries its profile and hooks together',
  )
  expect(issue({ hooks })).toBe(
    'a grapple mode carries its profile and hooks together',
  )
  expect(issue({ guard: 'quarry.rail' })).toBe(
    'a grapple guard or rise needs its profile',
  )
  expect(issue({ rise: true })).toBe(
    'a grapple guard or rise needs its profile',
  )
  expect(issue({ profile: tool, hooks: [] })).toBeDefined()
  expect(
    issue({ profile: { ...tool, cues: { fire: 'grapple.fire' } }, hooks }),
  ).toBeDefined()
  expect(issue({ profile: tool, hooks, spare: 1 })).toBeDefined()
})

// OF41c page half: a plain upload (no declared quest page, no runtime) owns its grapple, since the engine installs both the
// server's grapple and the page's claw from the row; a timing-only row still needs the page or runtime that installs it.
// The row's looks are graph looks the page compiles from `look.materials`.
const PAGE_RULE =
  'traverse modes require their declared page or runtime player phase'
function plainShard(
  grapple: readonly GrappleMode[],
  looked: boolean,
): Shardfile {
  // Brasscap's `metal` seeds the claw's looks (the retired Template 2 used its `door`); a later Brasscap export
  // without it seeds from its first material (J506), since any declared material makes the looks resolve.
  const base = outputFixture('corpus')
  const metal =
    base.look.materials['metal'] ?? Object.values(base.look.materials)[0]
  if (metal === undefined) {
    throw new Error('Missing seed material')
  }
  const ids = looked ? Object.values(tool.looks) : []
  const looks = Object.fromEntries(
    ids.map((id): [string, typeof metal] => [id, metal]),
  )
  return {
    ...base,
    modes: { traverse: [], grapple: [...grapple] },
    look: { ...base.look, materials: { ...base.look.materials, ...looks } },
  }
}
const claw =
  rows([{ ...timings, id: 'quarry.claw', profile: tool, hooks }]) ?? []

test('OF41c: a plain upload carries a grapple row with its tool', (): void => {
  const refusals = shardfileRules(plainShard(claw, true))
  const grappleRefusals = refusals.filter((line): boolean =>
    line.includes('grapple'),
  )
  expect(refusals).not.toContain(PAGE_RULE)
  expect(grappleRefusals).toEqual([])
})

test('OF41c: a grapple tool names looks look.materials declares', (): void => {
  const refusals = shardfileRules(plainShard(claw, false))
  expect(refusals).toContain(
    'grapple quarry.claw names look q-muzzle, which look.materials does not declare',
  )
})

test('OF41c: a timing-only grapple row still needs its page or runtime', (): void => {
  const timed = plainShard(rows([timings]) ?? [], true)
  expect(shardfileRules(timed)).toContain(PAGE_RULE)
})
