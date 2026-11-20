/* oxlint-disable typescript/prefer-readonly-parameter-types -- Validator rows retain their mutable format types. */
/* oxlint-disable unicorn/no-array-sort -- The portable library targets ES2022; sort fresh arrays. */
import { safeParse } from 'valibot'

import { SkinVariantsSchema } from './skins.ts'

import type { ShardRows } from './rows.ts'
import type { Shardfile } from './shardSchema.ts'

type Source = Pick<Shardfile, 'rows' | 'files'>
type Look = ShardRows['looks'][number]
const FIRST = 0

function parseTable(
  bytes: Uint8Array,
  lookId: string,
): Readonly<Record<string, string>> {
  const parsed = safeParse(
    SkinVariantsSchema,
    JSON.parse(new TextDecoder().decode(bytes)),
  )
  if (!parsed.success) {
    throw new Error(`skin look ${lookId}: invalid variant table`)
  }
  return parsed.output.skins
}

function checkCoverage(
  skins: Readonly<Record<string, string>>,
  ids: readonly string[],
): void {
  const expected = new Set(ids)
  const keys = Object.keys(skins)
  if (
    keys.length !== expected.size ||
    keys.some((key): boolean => !expected.has(key))
  ) {
    throw new Error('variant table must name every species variant exactly')
  }
}

function checkDependencies(
  skins: Readonly<Record<string, string>>,
  actual: readonly string[],
  defaultHash?: string,
): void {
  const dependencies = [...new Set(Object.values(skins))].sort()
  if (
    dependencies.length !== actual.length ||
    [...actual]
      .sort()
      .some((hash, index): boolean => hash !== dependencies[index])
  ) {
    throw new Error('variant table dependencies differ')
  }
  if (defaultHash !== undefined && !dependencies.includes(defaultHash)) {
    throw new Error('variant table must include its default skin')
  }
}

function variantTable(
  source: Source,
  look: Look,
  {
    assets,
    parameters,
  }: {
    assets: ReadonlyMap<string, Uint8Array>
    parameters: { variants: string; skin?: string }
  },
): Readonly<Record<string, string>> {
  const table = source.files.find(
    (file): boolean => file.hash === parameters.variants,
  )
  const bytes = assets.get(parameters.variants)
  if (table?.kind !== 'json' || bytes === undefined) {
    throw new Error(`skin look ${look.id}: variant table missing`)
  }
  const skins = parseTable(bytes, look.id)
  const species = source.rows.species.find(
    (row): boolean => row.id === look.species,
  )
  checkCoverage(
    skins,
    (species?.variants ?? []).map((row): string => row.id),
  )
  checkDependencies(skins, table.dependencies, parameters.skin)
  return skins
}

function speciesDefault(source: Source, look: Look): string {
  const id = source.rows.species.find((row): boolean => row.id === look.species)
    ?.variants[FIRST]?.id
  if (id === undefined) {
    throw new Error('skin variant table requires its species')
  }
  return id
}

export { speciesDefault, variantTable }
