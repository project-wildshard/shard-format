import { readFileSync } from 'node:fs'

import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { NativeAssemblySchema } from './nativeAssembly.ts'
import { parseOutputIndex } from './outputIndex.ts'
import {
  OUT_OF_SCOPE_HOSTS,
  PRIMITIVES,
  derivePrimitives,
  primitiveOfHost,
} from './primitives.ts'
import {
  ACCEPTED_SECTION_VERSIONS,
  sectionSchemaIssue,
} from './section-versions.ts'

const corpus = new URL('../../corpus/handwritten/', import.meta.url)
const indexText = readFileSync(new URL('shard.json', corpus), 'utf8')

function corpusSections(): Map<string, unknown> {
  const sections = new Map<string, unknown>()
  for (const { name, path } of parseOutputIndex(JSON.parse(indexText))
    .sections) {
    const text = readFileSync(new URL(path, corpus), 'utf8')
    sections.set(name, JSON.parse(text))
  }
  return sections
}

function names(rows: ReadonlyMap<string, unknown>): string[] {
  return derivePrimitives(rows).map((row): string => row.name)
}

const weatherRow = {
  id: 'forest',
  states: [{ id: 'clear', next: 'clear', length: [60, 120], numbers: {} }],
}

test('OF17a: a weather section with rows switches the weather primitive on, at its section version', (): void => {
  const sections = corpusSections()
  sections.set('world/weather', { rows: { weather: [weatherRow] } })
  expect(derivePrimitives(sections)).toContainEqual({
    name: 'weather',
    section: 'world/weather',
    version: 1,
  })
})

test('OF17a: an empty or missing weather section switches nothing on', (): void => {
  const sections = corpusSections()
  expect(sections.get('world/weather')).toEqual({ rows: { weather: [] } })
  expect(names(sections)).not.toContain('weather')
  sections.delete('world/weather')
  expect(names(sections)).not.toContain('weather')
})

test('OF17a: the always-on families come with every product, and the list is in table order', (): void => {
  expect(names(new Map())).toEqual(
    PRIMITIVES.filter((row): boolean => row.on === 'always').map(
      (row): string => row.name,
    ),
  )
  expect(names(new Map())).toContain('collision')
})

test('OF17a: a section at an unknown version refuses by name', (): void => {
  expect(
    sectionSchemaIssue('world/weather', 'wildshard:world/weather@1'),
  ).toBeUndefined()
  expect(sectionSchemaIssue('world/weather', 'wildshard:world/weather@2')).toBe(
    'section world/weather is at version 2; this format reads 1',
  )
  expect(sectionSchemaIssue('world/rain', 'wildshard:world/rain@1')).toBe(
    'unknown platform section world/rain',
  )
  expect(sectionSchemaIssue('world/weather', 'wildshard:world/days@1')).toBe(
    'section world/weather names the schema wildshard:world/days@1; expected wildshard:world/weather@<version>',
  )
  const raised = indexText.replace(
    '"wildshard:world/weather@1"',
    '"wildshard:world/weather@2"',
  )
  expect(raised).not.toBe(indexText)
  expect((): unknown => parseOutputIndex(JSON.parse(raised))).toThrow(
    'Unknown platform section schema: section world/weather is at version 2; this format reads 1',
  )
})

test('OF17a: the corpus index parses unchanged and every corpus section is at an accepted version', (): void => {
  const index = parseOutputIndex(JSON.parse(indexText))
  const raw: unknown = JSON.parse(indexText)
  expect(raw).toMatchObject({ sections: index.sections })
  for (const entry of index.sections) {
    expect(ACCEPTED_SECTION_VERSIONS[entry.name]).toEqual([1])
  }
})

test('OF17a: every switch names a registered section, and families and hosts are unique', (): void => {
  const families = PRIMITIVES.map((row): string => row.name)
  expect(new Set(families).size).toBe(families.length)
  for (const row of PRIMITIVES) {
    if (typeof row.on === 'object') {
      expect(ACCEPTED_SECTION_VERSIONS[row.on.section]).toBeDefined()
    }
  }
  const hosts = PRIMITIVES.flatMap((row): readonly string[] => row.hosts)
  expect(new Set(hosts).size).toBe(hosts.length)
})

/** Every `host` the native-assembly feature union names, read from its refusal of an unknown one. */
function nativeAssemblyHosts(): string[] {
  const result = safeParse(NativeAssemblySchema, {
    kind: 'native-assembly',
    level: { speed: 1, ground: { size: 1, height: 0 } },
    terrain: { kind: 'flat' },
    navigation: 'shard',
    entries: {},
    features: [{ host: 'no.such-host' }],
  })
  const expected = result.issues?.[0]?.expected ?? ''
  const hosts: string[] = []
  for (const { groups } of expected.matchAll(/"(?<host>[^"]+)"/gu)) {
    hosts.push(groups?.['host'] ?? '')
  }
  return hosts
}

test('OF17a: every native-assembly server host belongs to one family or is out of scope (HOSTS.md)', (): void => {
  const hosts = nativeAssemblyHosts()
  expect(hosts).toContain('boss.open-arena')
  const orphans = hosts.filter(
    (host): boolean =>
      primitiveOfHost(host) === undefined && !OUT_OF_SCOPE_HOSTS.includes(host),
  )
  expect(orphans).toEqual([])
  expect(primitiveOfHost('weather.native')).toBe('weather')
  expect(primitiveOfHost('quest.chapter')).toBeUndefined()
})
