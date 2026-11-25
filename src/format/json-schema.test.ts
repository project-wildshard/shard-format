// oxlint-disable typescript/prefer-readonly-parameter-types -- valibot schemas have no readonly form
import { custom, object } from 'valibot'
import { expect, test } from 'vitest'

import {
  formatJsonSchema,
  formatJsonSchemas,
  namedFormatJsonSchemas,
  namedFormatSchema,
  registeredJsonSchema,
} from './json-schema.ts'
import {
  CLIENT_ENVELOPE_SECTIONS,
  PLATFORM_DATA_SECTIONS,
} from './platformDataSections.ts'
import { PLATFORM_FILE_FAMILIES } from './platformFileFamilies.ts'
import { REGISTERED_JSON } from './registeredJson.ts'
import { TerrainSchema } from './terrain.ts'

import type { GenericSchema } from 'valibot'

// FORMAT-PRUNE FP9: the format owns the one JSON Schema projection. Every
// schema a shard file can name must project, or the SDK's build breaks the
// way Pine's did on 2026-11-21 (a v.custom with no bridge, format 33a3ce4).

// Sections and file families that do not project yet (FP9d bridges them).
// The list only shrinks: a new section that cannot project turns this red.
const UNPROJECTED: readonly string[] = [
  // Native assembly data, deleted at FP21.
  'file ^server/[a-z0-9][a-z0-9.-]*.json$',
  'section actors/spawn-scripts',
  'section actors/strikes',
  'section client/plan',
  'section explore/catalogue',
  'section held/equipment',
  'section held/loadout',
  'section look/colour-functions',
  'section look/painted',
  'section look/toon',
  'section player/stealth',
  'section sim/bodies',
  'section sim/runtime-plan',
  'section ui/completion',
  'section ui/strings',
  'section view/modules',
  'section world/physics',
  'section world/scenes',
  'section world/targets',
  'section world/vehicles',
]

const refusal = (label: string, schema: GenericSchema): string | undefined => {
  try {
    formatJsonSchema(schema)
    return undefined
  } catch {
    return label
  }
}

test('FP9: every wire root and named contract projects', (): void => {
  expect(Object.keys(formatJsonSchemas()).length).toBeGreaterThan(200)
  expect(Object.keys(namedFormatJsonSchemas()).length).toBeGreaterThan(200)
})

test('FP9: every registered JSON name projects to its defining source', (): void => {
  const contracts: readonly (readonly [string, { readonly source: string }])[] =
    Object.entries(REGISTERED_JSON)
  for (const [name, contract] of contracts) {
    expect(registeredJsonSchema(name)?.['$comment'], name).toBe(contract.source)
  }
})

test('FP9: every data section and file family projects, bar the listed ones', (): void => {
  const sections = Object.entries({
    ...PLATFORM_DATA_SECTIONS,
    ...CLIENT_ENVELOPE_SECTIONS,
  })
  const refused = [
    ...sections.map(([name, row]): string | undefined =>
      refusal(`section ${name}`, row.schema),
    ),
    ...PLATFORM_FILE_FAMILIES.map((family): string | undefined =>
      refusal(
        `file ${family.pattern.source.replaceAll('\\', '')}`,
        family.schema,
      ),
    ),
  ].filter((label): label is string => label !== undefined)
  expect(refused.toSorted()).toEqual(UNPROJECTED)
})

test('FP9: a v.custom with no bridge is refused', (): void => {
  const seeded = object({
    id: custom<string>((value): boolean => typeof value === 'string'),
  })
  expect((): unknown => formatJsonSchema(seeded)).toThrow(/custom/u)
})

test('FP9c: a named format root resolves to its defining schema, and an unknown name throws', (): void => {
  expect(namedFormatSchema('terrain.Terrain')).toBe(TerrainSchema)
  expect((): unknown => namedFormatSchema('nope.NoSchema')).toThrow(
    'Unknown named format contract',
  )
})
