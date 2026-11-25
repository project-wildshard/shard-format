import { parse, pick, safeParse } from 'valibot'
import { expect, it } from 'vitest'

import {
  compileIncomingCapPolicy,
  IncomingCapTagsSchema,
} from './incoming-cap-policy.ts'
import { ManifestMetadataSchema } from './minimap.ts'
import { NativeHuntSchema } from './speciesPrograms.ts'

const manifestFight = pick(ManifestMetadataSchema, ['fight'])
const hunt = (fight: Readonly<Record<string, unknown>>): unknown => ({
  limit: 8,
  player: 'host',
  fight,
  bands: { states: [] },
  hit: { namespace: 'hunt', tags: [] },
})

it('compiles short aliases and exact request tags without changing input', (): void => {
  const capExempt = Object.freeze([
    'bear',
    'state.rage',
    'creature.bear',
    'effect.mark:hot',
  ])
  expect(compileIncomingCapPolicy({ capExempt })).toEqual([
    'creature.bear',
    'state.rage',
    'creature.state.rage',
    'creature.creature.bear',
    'effect.mark:hot',
    'creature.effect.mark:hot',
  ])
  expect(capExempt).toEqual([
    'bear',
    'state.rage',
    'creature.bear',
    'effect.mark:hot',
  ])
  expect(compileIncomingCapPolicy({})).toEqual([])
})

it('keeps the complete manifest boundary and treats punctuation literally', (): void => {
  const capExempt = Array.from(
    { length: 256 },
    (_unused, index): string => `tag.${index}${'x'.repeat(504)}`,
  )
  const tags = compileIncomingCapPolicy({ capExempt })
  expect(tags).toHaveLength(512)
  expect(tags[1]).toBe(`creature.${capExempt[0]}`)
  expect(
    compileIncomingCapPolicy({ capExempt: ['state.*', 'unusual name'] }),
  ).toEqual(['state.*', 'creature.state.*', 'creature.unusual name'])
})

it('admits exact-only policies and refuses malformed or divergent dual declarations', (): void => {
  expect(compileIncomingCapPolicy({ capExemptTags: ['state.rage'] })).toEqual([
    'state.rage',
  ])
  expect(
    compileIncomingCapPolicy({
      capExempt: ['bear'],
      capExemptTags: ['creature.bear'],
    }),
  ).toEqual(['creature.bear'])
  for (const input of [
    ['bear'],
    ['a.b', 'a.b'],
    [42],
    ['a.'.padEnd(522, 'x')],
    Array.from({ length: 513 }, (): string => 'a.b'),
  ]) {
    expect(safeParse(IncomingCapTagsSchema, input).success).toBe(false)
  }
  expect((): string[] =>
    compileIncomingCapPolicy({ capExempt: ['bear'], capExemptTags: [] }),
  ).toThrow()
  expect((): string[] =>
    compileIncomingCapPolicy({
      capExempt: Array.from({ length: 257 }, (): string => 'bear'),
    }),
  ).toThrow()
})

it('validates the same exact policy at manifest and native admission', (): void => {
  const fight = {
    capExempt: ['bear', 'state.rage'],
    capExemptTags: ['creature.bear', 'state.rage', 'creature.state.rage'],
  }
  expect(parse(manifestFight, { fight }).fight).toEqual(fight)
  expect(parse(NativeHuntSchema, hunt(fight)).fight).toEqual(fight)
  for (const capExemptTags of [['bear'], [], ['creature.bear']]) {
    expect(
      safeParse(manifestFight, { fight: { ...fight, capExemptTags } }).success,
    ).toBe(false)
    expect(
      safeParse(NativeHuntSchema, hunt({ ...fight, capExemptTags })).success,
    ).toBe(false)
  }
})
