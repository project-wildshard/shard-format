import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { declaredGrappleProfile, parseGrappleProfile } from './grapple.ts'
import { ModesSchema } from './modes.ts'

// ONE-FORMAT OF41c: a plain `state/modes` grapple row carries what the native host read from its own files (a profile
// file, a hooks file and a guard owner), so the declared path can install the grapple with no native assembly. The row's
// own timings are the course's mode; a row without the new fields parses as it did.
const tool = {
  course: {
    name: 'Quarry',
    clearance: { axis: 'x', plane: 0, min: -4, max: 4, base: 0, top: 2, ceiling: 8, owners: ['quarry.rail'] },
  },
  cues: { fire: 'grapple.fire', bite: 'grapple.bite', zip: 'grapple.zip', reel: 'grapple.reel', dock: 'grapple.dock' },
  looks: { muzzle: 'q-muzzle', bite: 'q-bite', dock: 'q-dock', sparks: 'q-sparks', ribbon: 'q-ribbon' },
  fact: { name: 'quarry.crossed', entity: 'quarry.pit', source: 'quarry.crossing' },
  headless: { step: 'quarry.claw', lock: 'quarry.lock', aim: 'quarry.pitch', eye: 1.68, aspect: 1, portraitFov: 70 },
}
const hooks = [{ x: -4, y: 2, z: 0 }, { x: 10, y: 130, z: -3 }]
const modes = (grapple: unknown[]) => safeParse(ModesSchema, { grapple })
const rows = (grapple: unknown[]) => { const parsed = modes(grapple); return parsed.success ? parsed.output.grapple : undefined }

test('OF41c: a grapple mode with a profile and hooks parses, and its profile is the native profile', () => {
  expect(modes([{ id: 'quarry.claw', zipSpeed: 14, profile: tool, hooks, guard: 'quarry.rail', rise: true }]).issues).toBeUndefined()
  const row = rows([{ id: 'quarry.claw', zipSpeed: 14, profile: tool, hooks, guard: 'quarry.rail', rise: true }])?.[0]
  if (row === undefined) throw new Error('Missing grapple row')
  expect(row.hooks).toEqual(hooks)
  expect(row.guard).toBe('quarry.rail')
  expect(row.rise).toBe(true)
  const profile = declaredGrappleProfile(row)
  expect(profile).toEqual(parseGrappleProfile({ ...tool, id: 'quarry.claw', course: { ...tool.course,
    mode: { id: 'quarry.claw', zipSpeed: 14 } } }))
  expect(profile?.course.mode).toEqual({ id: 'quarry.claw', minRange: 2.5, maxRange: 38, zipSpeed: 14, fireTime: 0.27,
    biteTime: 0.1, reelTime: 0.48, windowX: 0.52, windowY: 0.68 })
})

test('OF41c: a grapple mode without the new fields parses byte-identical and has no declared profile', () => {
  const row = { id: 'hook', minRange: 2.5, maxRange: 38, zipSpeed: 22, fireTime: 0.27, biteTime: 0.1, reelTime: 0.48,
    windowX: 0.52, windowY: 0.68 }
  const parsed = rows([row])
  expect(parsed).toEqual([row])
  expect(JSON.stringify(parsed?.[0])).toBe(JSON.stringify(row))
  const only = parsed?.[0]
  if (only === undefined) throw new Error('Missing grapple row')
  expect(declaredGrappleProfile(only)).toBeUndefined()
})

test('OF41c: a profile needs its hooks, hooks need a profile, and guard and rise need both', () => {
  const issue = (row: Record<string, unknown>): string | undefined => modes([{ id: 'hook', ...row }]).issues?.[0]?.message
  expect(issue({ profile: tool })).toBe('a grapple mode carries its profile and hooks together')
  expect(issue({ hooks })).toBe('a grapple mode carries its profile and hooks together')
  expect(issue({ guard: 'quarry.rail' })).toBe('a grapple guard or rise needs its profile')
  expect(issue({ rise: true })).toBe('a grapple guard or rise needs its profile')
  expect(issue({ profile: tool, hooks: [] })).toBeDefined()
  expect(issue({ profile: { ...tool, cues: { fire: 'x' } }, hooks })).toBeDefined()
  expect(issue({ profile: tool, hooks, spare: 1 })).toBeDefined()
})
