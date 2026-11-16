import type { SourceFile } from './one-way-source.ts'

interface ProductFacts {
  readonly slug: string
  readonly hosts: readonly string[]
  readonly pageKinds: readonly string[]
  readonly kinds: readonly string[]
  readonly missingLooks: number
  readonly speciesPrograms: number
  readonly manifestFields: readonly string[]
}
const NONE = 0
const ONE = 1
const repeatedFields = new Set([
  'sky',
  'atmosphere',
  'grade',
  'horizon',
  'spawn',
  'loadout',
  'weapon',
  'species',
  'spawns',
  'faunaTuning',
  'audio',
  'minimap',
])
const excludedPagePrefixes = ['world.', 'view.']
const excludedPageKinds = new Set(['page.life'])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function object(value: unknown): Readonly<Record<string, unknown>> {
  return isObject(value) ? value : {}
}
function rows(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}
function strings(values: readonly unknown[]): readonly string[] {
  return values.filter(
    (value: unknown): value is string => typeof value === 'string',
  )
}
function read(file: Readonly<SourceFile>): Readonly<Record<string, unknown>> {
  const data: unknown = JSON.parse(file.text)
  return object(data)
}
function section(
  files: readonly SourceFile[],
  name: string,
): Readonly<Record<string, unknown>> {
  const file = files.find(
    (candidate: Readonly<SourceFile>): boolean =>
      candidate.path === `sections/${name}.json`,
  )
  return file === undefined ? {} : read(file)
}
function nativeHosts(files: readonly SourceFile[]): readonly string[] {
  return files.flatMap((file: Readonly<SourceFile>): readonly string[] => {
    const data = read(file)
    return data['kind'] === 'native-assembly'
      ? strings(
          rows(data['features']).map(
            (feature: unknown): unknown => object(feature)['host'],
          ),
        )
      : []
  })
}
function speciesData(
  files: readonly SourceFile[],
): Readonly<Record<string, unknown>> {
  const actors = object(section(files, 'actors/species')['rows'])
  const materials = object(section(files, 'look/materials')['rows'])
  return {
    ...actors,
    looks: [...rows(actors['looks']), ...rows(materials['looks'])],
  }
}
function missingLooks(data: Readonly<Record<string, unknown>>): number {
  const looks = rows(data['looks']).map(
    (value: unknown): Readonly<Record<string, unknown>> => object(value),
  )
  return rows(data['species']).filter((value: unknown): boolean => {
    const row = object(value)
    const body = object(row['body'])
    return !looks.some(
      (look: Readonly<Record<string, unknown>>): boolean =>
        look['species'] === row['id'] ||
        (typeof body['look'] === 'string' && look['id'] === body['look']),
    )
  }).length
}

function productFacts(
  slug: string,
  files: readonly SourceFile[],
): ProductFacts {
  const declared = speciesData(files)
  const programs = section(files, 'actors/species-programs')
  const species = [
    ...rows(declared['species']),
    ...rows(programs['native']),
    ...rows(programs['page']),
  ]
  return {
    slug,
    hosts: [...new Set(nativeHosts(files))],
    pageKinds: strings(
      rows(section(files, 'client/plan')['features']).map(
        (value: unknown): unknown => object(value)['kind'],
      ),
    ),
    kinds: strings(
      species.map((value: unknown): unknown => object(value)['kind']),
    ),
    missingLooks: missingLooks(declared),
    speciesPrograms: Object.keys(programs).length === NONE ? NONE : ONE,
    manifestFields: Object.keys(
      object(section(files, 'ui/level')['manifest']),
    ).filter((name: string): boolean => repeatedFields.has(name)),
  }
}

function singleUse(
  products: readonly ProductFacts[],
  field: 'hosts' | 'pageKinds',
): number {
  const users = new Map<string, Set<string>>()
  for (const product of products) {
    for (const name of product[field]) {
      if (
        field !== 'pageKinds' ||
        (!excludedPageKinds.has(name) &&
          !excludedPagePrefixes.some((prefix: string): boolean =>
            name.startsWith(prefix),
          ))
      ) {
        const slugs = users.get(name) ?? new Set<string>()
        slugs.add(product.slug)
        users.set(name, slugs)
      }
    }
  }
  return [...users.values()].filter(
    (slugs: ReadonlySet<string>): boolean => slugs.size === ONE,
  ).length
}

function productCounts(
  products: readonly ProductFacts[],
): Readonly<Record<string, number>> {
  return {
    'products.rows-without-look': products.reduce(
      (total: number, product: Readonly<ProductFacts>): number =>
        total + product.missingLooks,
      NONE,
    ),
    'products.species-program-sections': products.reduce(
      (total: number, product: Readonly<ProductFacts>): number =>
        total + product.speciesPrograms,
      NONE,
    ),
    'products.repeated-manifest-fields': new Set(
      products.flatMap(
        (product: Readonly<ProductFacts>): readonly string[] =>
          product.manifestFields,
      ),
    ).size,
    'products.single-shard-server-hosts': singleUse(products, 'hosts'),
    'products.single-shard-page-features': singleUse(products, 'pageKinds'),
  }
}

export { productCounts, productFacts }
export type { ProductFacts }
