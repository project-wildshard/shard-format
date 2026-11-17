import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { admissionFixture, digest } from '../test/helpers/perch-assets.ts'
import { validateShardfileAssets } from './assetAdmission.ts'
import { creaturePerchAdmissionRows } from './creature-perch.ts'
import { CreaturesSchema } from './creatures.ts'
import { fixture, perch } from './fixtures/perch-authority.ts'
import { shardfileRules } from './shardSchema.ts'

test('whole-shard rules resolve the projectile strike as well as the bite', (): void => {
  const { shard } = admissionFixture()
  expect(shardfileRules(shard)).toEqual([])
  const body = shard.creatures.perchBodies?.[0]
  if (body === undefined) {
    throw new Error('Missing fixture body')
  }
  body.projectile.strike = 'missing.throw'
  expect(shardfileRules(shard)).toContain('declared perch body strikes')
})

test('the normal asset validator admits actual perch VM bytes', (): void => {
  const { shard, assets, scripts } = admissionFixture()
  expect((): void => {
    validateShardfileAssets(
      shard,
      assets,
      digest,
      undefined,
      undefined,
      scripts,
    )
  }).not.toThrow()
})

test('perch VM pages are charged to the declared whole-host memory', (): void => {
  const { shard, assets, scripts } = admissionFixture()
  shard.budgets.sim.resident = shard.files.reduce(
    (sum: number, file: Readonly<{ decoded: number; gpu: number }>): number =>
      sum + file.decoded + file.gpu,
    0,
  )
  expect((): void => {
    validateShardfileAssets(
      shard,
      assets,
      digest,
      undefined,
      undefined,
      scripts,
    )
  }).toThrow(/script memory budget/u)
})

test('nine other real modules cannot hide a tenth perch VM', (): void => {
  const { shard, assets, scripts } = admissionFixture(9)
  expect((): void => {
    validateShardfileAssets(
      shard,
      assets,
      digest,
      undefined,
      undefined,
      scripts,
    )
  }).toThrow(/nine|host cap|instance/u)
})

test('eight other modules plus a shared perch program use nine real VMs once', (): void => {
  const { shard, assets, scripts } = admissionFixture(8)
  const body = shard.creatures.perchBodies?.[0]
  if (body === undefined) {
    throw new Error('Missing fixture body')
  }
  shard.creatures.perchBodies?.push({ ...body, id: 'fixture.second' })
  expect((): void => {
    validateShardfileAssets(
      shard,
      assets,
      digest,
      undefined,
      undefined,
      scripts,
    )
  }).not.toThrow()
  expect(
    creaturePerchAdmissionRows(shard.creatures.perchBodies ?? [], scripts),
  ).toHaveLength(1)
})

test('perch rows sharing a declared VM retain its admission and reject conflicting pages', (): void => {
  const { shard } = admissionFixture()
  const bodies = shard.creatures.perchBodies ?? []
  const rows = creaturePerchAdmissionRows(bodies)
  expect(creaturePerchAdmissionRows(bodies, rows)).toEqual([])
  const [first] = rows
  if (first === undefined || first.abi === 2) {
    throw new Error('Missing ABI-1 fixture')
  }
  expect((): void => {
    creaturePerchAdmissionRows(bodies, [{ ...first, pages: 2 }])
  }).toThrow('Conflicting perch module contracts')
})

test('two same-species spawns retain their explicitly selected different body authorities', (): void => {
  const base = parse(CreaturesSchema, fixture()),
    [first] = base.spawns
  if (first === undefined) {
    throw new Error('Missing fixture spawn')
  }
  const parsed = parse(CreaturesSchema, {
    ...base,
    perchBodies: [
      perch,
      {
        ...perch,
        id: 'fixture.second',
        sites: [{ at: [5, 6, 7], base: [5, 0, 7] }],
      },
    ],
    spawns: [
      first,
      { ...first, id: 'fixture.other', perchBody: 'fixture.second' },
    ],
  })
  expect(
    parsed.spawns.map(
      (spawn: Readonly<{ perchBody?: string }>): string | undefined =>
        spawn.perchBody,
    ),
  ).toEqual(['fixture.perch', 'fixture.second'])
  expect(parsed.perchBodies?.[1]?.sites[0]?.at).toEqual([5, 6, 7])
})
