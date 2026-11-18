import { OUTPUT_SECTIONS } from './outputFields.ts'
import { PLATFORM_DATA_SECTIONS } from './platformDataSections.ts'

/** The one version every section is at today. */
const FIRST_VERSION = 1
/** How much of a bad schema string a refusal quotes. */
const QUOTED_SCHEMA_CHARS = 120
const FIRST_CHAR = 0

/**
 * ONE-FORMAT OF17a, SHARD-COMPAT §3.3: the section versions this format reads. A section's version is the `@N` its index
 * row already names (`schema: "wildshard:<name>@<N>"`), never a field in its body. Every section is at version 1 today;
 * an additive change keeps `[1]`, a removal adds `@2` beside `@1` and drops `@1` only at SHARD-COMPAT's B release.
 */
const ACCEPTED_SECTION_VERSIONS: Readonly<Record<string, readonly number[]>> =
  Object.freeze(
    Object.fromEntries(
      [
        ...OUTPUT_SECTIONS.map((row): string => row.name),
        ...Object.keys(PLATFORM_DATA_SECTIONS),
      ].map((name): [string, readonly number[]] => [
        name,
        Object.freeze([FIRST_VERSION]),
      ]),
    ),
  )

const SCHEMA = /^wildshard:(?<name>[^@]+)@(?<version>0|[1-9]\d{0,5})$/u

/** The version an index row's schema names, when it names its own section; `undefined` otherwise. */
function sectionSchemaVersion(
  name: string,
  schema: string,
): number | undefined {
  const match = SCHEMA.exec(schema)
  return match?.groups?.['name'] === name
    ? Number(match.groups['version'])
    : undefined
}

/** Why an index row's section and schema are not ones this format reads, as one named line; `undefined` when they are. */
function sectionSchemaIssue(name: string, schema: string): string | undefined {
  const accepted = Object.hasOwn(ACCEPTED_SECTION_VERSIONS, name)
    ? ACCEPTED_SECTION_VERSIONS[name]
    : undefined
  if (accepted === undefined) {
    return `unknown platform section ${name}`
  }
  const version = sectionSchemaVersion(name, schema)
  if (version === undefined) {
    return `section ${name} names the schema ${schema.slice(FIRST_CHAR, QUOTED_SCHEMA_CHARS)}; expected wildshard:${name}@<version>`
  }
  return accepted.includes(version)
    ? undefined
    : `section ${name} is at version ${String(version)}; this format reads ${accepted.join(', ')}`
}

export {
  ACCEPTED_SECTION_VERSIONS,
  FIRST_VERSION,
  sectionSchemaIssue,
  sectionSchemaVersion,
}
