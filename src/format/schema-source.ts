/** FORMAT-PRUNE FP10: each named JSON file's `jsonSchema.$comment` names the format module that defines it. A module
 * renamed after files shipped leaves a stale id in shard data; the chain step `fp10-schema-source` rewrites it, and
 * until every kept file is mended (FE7 counts `schema-source.retired`), readers take the old id as the new one. The
 * map empties, and this file goes, at FP22. */

/** Retired id to current id. */
const RETIRED_SCHEMA_SOURCES: Readonly<Record<string, string>> = {
  // SA23 kept the old id because it was shard data; the module is directorDocument.
  '@wildshard/format/directorProduct#DirectorProductSchema':
    '@wildshard/format/directorDocument#DirectorDocumentSchema',
}

/** The current id for `source`, retired or not. */
function currentSchemaSource(source: unknown): unknown {
  if (
    typeof source === 'string' &&
    Object.hasOwn(RETIRED_SCHEMA_SOURCES, source)
  ) {
    return RETIRED_SCHEMA_SOURCES[source]
  }
  return source
}

/** Whether `source` is a retired id. */
function retiredSchemaSource(source: unknown): boolean {
  return (
    typeof source === 'string' && Object.hasOwn(RETIRED_SCHEMA_SOURCES, source)
  )
}

/** FE7's row for FP10, in the registry's shape (`deprecations.ts`). */
interface SchemaSourceDeprecation {
  readonly id: string
  readonly path: string
  readonly since: string
  readonly replacement: string
  readonly migration: string
  readonly uses: (shard: Readonly<{ index: unknown }>) => boolean
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Reflect.get(value, key)
    : undefined
}

const SCHEMA_SOURCE_DEPRECATION: SchemaSourceDeprecation = {
  id: 'schema-source.retired',
  path: 'shard.json files[].jsonSchema.$comment naming a retired module (FORMAT-PRUNE FP10)',
  since: '0.1.0.4',
  replacement:
    'the current defining module, e.g. @wildshard/format/directorDocument#DirectorDocumentSchema',
  migration: 'fp10-schema-source',
  uses: (shard: Readonly<{ index: unknown }>): boolean => {
    const files = field(shard.index, 'files')
    return (
      Array.isArray(files) &&
      files.some((file: unknown): boolean =>
        retiredSchemaSource(field(field(file, 'jsonSchema'), '$comment')),
      )
    )
  },
}

export {
  RETIRED_SCHEMA_SOURCES,
  SCHEMA_SOURCE_DEPRECATION,
  currentSchemaSource,
  retiredSchemaSource,
}
