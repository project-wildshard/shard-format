import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { CreatureStrikeSchema } from './creatures.ts'
import { parseRows } from './rows.ts'
import { parseShardfile, shardfileRules } from './shardSchema.ts'
import {
  readSpecies,
  readSpeciesProgram,
  readSpeciesPrograms,
} from './speciesPrograms.ts'
import { StrikeDebrisSchema } from './strike-debris.ts'
import { parseWeaponProfile } from './weaponProfiles.ts'

import type { StrikeRows, SpeciesRow } from './rows.ts'
import type { StrikeDebrisPolicy } from './strike-debris.ts'
import type { MeleeWeaponProfileRows } from './weaponProfiles.ts'

const species: SpeciesRow = {
  id: 'fixture.shell',
  kind: 'own.label',
  label: 'Shell',
  capExempt: true,
  aggressive: false,
  lockable: true,
  dims: {
    bodyY: 1,
    bodyHalfLen: 0.5,
    bodyRadius: 0.3,
    headRadius: 0.3,
    legLen: 0.5,
    feet: [],
    halfWidth: 0.4,
  },
  variants: [
    {
      id: 'plain',
      label: 'Plain',
      rarity: 'common',
      weight: 1,
      scale: [1, 1],
      hp: 25,
      mods: {
        speed: 1,
        chargeDist: 1,
        damageTaken: 1,
        chargeDamage: 0,
        relentless: false,
      },
    },
  ],
}
const debris: StrikeDebrisPolicy = {
  default: { surface: 'sand', count: 10, atFeet: true, sparks: false },
  overrides: [
    {
      target: species.id,
      effect: { surface: 'shell', count: 9, atFeet: false, sparks: true },
    },
  ],
}
function strike(): StrikeRows {
  return {
    id: 'fixture.blow',
    shape: { kind: 'point', radius: 1 },
    windup: 0,
    active: 0,
    recover: 0,
    cooldown: 1,
    range: 2,
    damage: 1,
    tags: [],
    weight: 1,
    speed: 0,
    debris: structuredClone(debris),
  }
}
function profile(): MeleeWeaponProfileRows {
  const swing: MeleeWeaponProfileRows['moves']['heavy'] = {
    windup: 0,
    slashEnd: 0.1,
    total: 0.2,
    damage: 1,
    debris: structuredClone(debris),
  }
  return {
    family: 'melee',
    damage: 1,
    reach: 2,
    swingScale: 1,
    cooldown: 1,
    comboGap: 1,
    chainLag: 1,
    heavyCharge: 1,
    moves: {
      combo: [swing],
      heavy: swing,
      passes: { left: swing, right: swing },
    },
    lunge: {
      range: 1,
      heavyRange: 1,
      cone: 1,
      stop: 1,
      speed: 1,
      minTime: 0,
      maxTime: 1,
    },
    sweep: { rays: 1, extensions: [1], step: 1, maxSamples: 1, maxHits: 1 },
  }
}
test('debris bounds effects and explicit targets before reading accessors or callbacks', (): void => {
  expect(parse(StrikeDebrisSchema, debris)).toEqual(debris)
  for (const count of [-1, 0.5, 65, Infinity, Number.NaN]) {
    expect((): unknown =>
      parse(StrikeDebrisSchema, { default: { ...debris.default, count } }),
    ).toThrow()
  }
  expect((): unknown =>
    parse(StrikeDebrisSchema, {
      ...debris,
      overrides: [...(debris.overrides ?? []), ...(debris.overrides ?? [])],
    }),
  ).toThrow('unique debris targets')
  expect((): unknown =>
    parse(StrikeDebrisSchema, {
      default: { ...debris.default, surface: 'own.material' },
    }),
  ).toThrow()
  expect((): unknown =>
    parse(StrikeDebrisSchema, {
      ...debris,
      pick: (): unknown => debris.default,
    }),
  ).toThrow()
  let reads = 0
  expect((): unknown =>
    parse(StrikeDebrisSchema, {
      get default(): unknown {
        reads += 1
        return debris.default
      },
    }),
  ).toThrow('plain strike debris')
  expect(reads).toBe(0)
})
test('real rows retain a cap flag and resolve strike debris by species row id', (): void => {
  const shard = outputFixture()
  shard.rows.species.push(structuredClone(species))
  const input = { ...shard.rows, strikes: [strike()] },
    parsed = parseRows(input)
  expect(parsed.species.at(-1)?.capExempt).toBe(true)
  expect(parsed.strikes[0]?.debris).toEqual(debris)
  expect((): unknown =>
    parseRows({ ...input, species: [{ ...species, capExempt: 'captain' }] }),
  ).toThrow()
  expect((): unknown => parseRows({ ...input, species: [] })).toThrow(
    'Unknown debris target species',
  )
})
test('older species/program contracts retain the flag and validate their target catalogue', (): void => {
  const native = {
    id: species.id,
    kind: species.kind,
    label: species.label,
    variants: species.variants,
    capExempt: true,
  }
  const { speed: _speed, ...contact } = {
    ...strike(),
    weight: { kind: 'constant', value: 1 },
  }
  expect(readSpecies(native).capExempt).toBe(true)
  expect(
    readSpeciesPrograms({ page: [native], native: [native] }).native[0]
      ?.capExempt,
  ).toBe(true)
  expect(parse(CreatureStrikeSchema, contact).debris).toEqual(debris)
  expect(
    readSpeciesProgram({ species: [native], strikes: [contact] }).strikes[0]
      ?.debris,
  ).toEqual(debris)
  expect((): unknown =>
    readSpeciesProgram({ species: [], strikes: [contact] }),
  ).toThrow('Strike debris references')
})
test('melee profiles keep debris on combo, heavy and mounted pass swings', (): void => {
  const parsed = parseWeaponProfile(profile())
  if (parsed.family !== 'melee') {
    throw new Error('Missing melee profile')
  }
  expect(parsed.moves.combo[0]?.debris).toEqual(debris)
  expect(parsed.moves.heavy.debris).toEqual(debris)
  expect(parsed.moves.passes?.left.debris).toEqual(debris)
  expect(parsed.moves.passes?.right.debris).toEqual(debris)
})
test('full shard admission refuses an item swing naming an unknown target species', (): void => {
  const shard = outputFixture()
  shard.rows.species.push(structuredClone(species))
  const attack = {
    id: 'fixture.hit',
    damage: 1,
    cooldown: 1,
    range: 2,
    width: 1,
    tags: [],
    // oxlint-disable-next-line unicorn/no-null -- The attack wire contract requires an explicit null effect.
    effect: null,
  }
  shard.items.rows.push({
    id: 'weapon.fixture',
    kind: 'weapon',
    family: 'melee',
    slot: 'declared.weapon.fixture',
    context: 'weapon.melee',
    ui: { name: 'Fixture', icon: 'sword', swapIcon: '', blurb: '' },
    view: {
      recipe: 'kit.sword',
      colour: '#ffffff',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    },
    // oxlint-disable-next-line unicorn/no-null -- A fixture without a script uses the existing explicit null hook.
    hook: null,
    light: attack,
    heavy: attack,
    charge: 1,
    profile: parseWeaponProfile(profile()),
  })
  shard.items.loadout.primary = 'weapon.fixture'
  expect(shardfileRules(shard)).toEqual([])
  expect(parseShardfile(shard).items.rows.at(-1)?.kind).toBe('weapon')
  shard.rows.species = shard.rows.species.filter(
    (row: Readonly<{ id: string }>): boolean => row.id !== species.id,
  )
  expect(shardfileRules(shard)).toContain(
    `Unknown debris target species: ${species.id}`,
  )
  expect((): unknown => parseShardfile(shard)).toThrow(
    'shardfile semantic rules',
  )
})
