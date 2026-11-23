import { writeFile } from 'node:fs/promises'

import {
  array,
  number,
  optional,
  parse,
  record,
  strictObject,
  string,
} from 'valibot'

import type { CorpusRow } from './corpus.ts'

// SHARD-COMPAT FE13: what the delete gate reads. `shard-format corpus
// --usage <file>` records, for every kept original, the deprecated paths it
// uses (FE7) and the chain steps it needs to validate (an original the
// format refuses as stored, judged through the chain: `migrated: <ids>`).
// A deprecated part or a migration step may be deleted only while its list
// here is empty and the record is fresh.

interface Usage {
  readonly measuredAt: string
  readonly validator: string
  readonly originals: number
  readonly deprecations: Readonly<Record<string, readonly string[]>>
  readonly migrations: Readonly<Record<string, readonly string[]>>
  /** FE13: how many engine-pinned shard files the run covered; absent when it ran without `--pins`. */
  readonly pins?: number | undefined
}

const Users = record(string(), array(string()))
const UsageSchema = strictObject({
  measuredAt: string(),
  validator: string(),
  originals: number(),
  deprecations: Users,
  migrations: Users,
  pins: optional(number()),
})
const MIGRATED = 'migrated: '
const INDENT = 1
const NO_PINS = 0

function add(
  users: Map<string, string[]>,
  ids: readonly string[],
  name: string,
): void {
  for (const id of ids) {
    users.set(id, [...(users.get(id) ?? []), name])
  }
}

function stepsOf(reason: string | undefined): readonly string[] {
  return reason?.startsWith(MIGRATED) === true
    ? reason
        .slice(MIGRATED.length)
        .split(',')
        .map((step: string): string => step.trim())
        .filter((step: string): boolean => step !== '')
    : []
}

/** FE13: how many rows engine pins. */
function pinsOf(rows: readonly Readonly<CorpusRow>[]): number {
  return rows.filter(
    (found: Readonly<CorpusRow>): boolean => found.pinned === true,
  ).length
}

/** Who uses each deprecated path and each chain step, over the kept originals. */
function corpusUsage(
  rows: readonly Readonly<CorpusRow>[],
  validator: string,
  measuredAt: Readonly<Date>,
): Usage {
  const deprecations = new Map<string, string[]>()
  const migrations = new Map<string, string[]>()
  for (const found of rows) {
    const name = `${found.slug} r${String(found.revision)}${found.pinned === true ? ' (engine pin)' : ''}`
    add(deprecations, found.deprecations, name)
    add(migrations, stepsOf(found.reason), name)
  }
  const usage: Usage = {
    measuredAt: measuredAt.toISOString(),
    validator,
    originals: rows.length,
    deprecations: Object.fromEntries(deprecations),
    migrations: Object.fromEntries(migrations),
  }
  const pins = pinsOf(rows)
  return pins === NO_PINS ? usage : { ...usage, pins }
}

async function writeUsage(file: string, usage: Readonly<Usage>): Promise<void> {
  await writeFile(file, `${JSON.stringify(usage, undefined, INDENT)}\n`)
}

/** A usage record's text, checked. */
function readUsage(text: string): Usage {
  return parse(UsageSchema, JSON.parse(text))
}

export { corpusUsage, readUsage, writeUsage }
export type { Usage }
