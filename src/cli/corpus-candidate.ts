/** SHARD-COMPAT FE3b (J486 Q51): the corpus runs a candidate chain and validator beside the current one, so a format change
 * is judged against every kept original before it ships. A candidate is a module that names its extra migrations (run
 * after the current chain, over the copy's JSON sections: a candidate's shape is one the current reader refuses) and a
 * check over the copy (the parts the candidate's validator changes). An original is `migrates` when the candidate's
 * steps changed its copy and the copy passes, `valid` when they changed nothing and it passes, and `fails` naming the
 * path the candidate refuses. */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { brotliDecompress } from 'node:zlib'

import {
  INDEX,
  readJson,
  readSections,
  record,
  rows,
} from '../format/format-migrate-inventory.ts'
import { migrateShardfile } from '../format/format-migrate.ts'
import { FORMAT_MIGRATIONS } from '../format/format-migrations.ts'
import { readTar } from '../format/tar.ts'

import type { JsonRecord } from '../format/format-migrate-inventory.ts'
import type {
  FormatMigration,
  MigratingShard,
} from '../format/format-migrations.ts'

type Files = ReadonlyMap<string, Uint8Array>

/** One part a candidate refuses: the member path and the place in it. */
interface CandidateFailure {
  readonly path: string
  readonly reason: string
}

/** A candidate format change, as a module's `candidate` export. */
interface Candidate {
  readonly id: string
  /** Steps the candidate adds after the current chain, over its JSON sections. */
  readonly migrations?: readonly FormatMigration[]
  /** What the candidate's validator refuses in the migrated copy. */
  readonly check: (files: Files) => readonly CandidateFailure[]
}

interface CandidateVerdict {
  readonly verdict: 'valid' | 'migrates' | 'fails'
  /** The candidate's own steps that changed the copy. */
  readonly applied: readonly string[]
  readonly failures: readonly CandidateFailure[]
}

interface Named {
  readonly shard: string
  readonly revision: number
}

const NONE = 0
const unbrotli = promisify(brotliDecompress)
const encoder = new TextEncoder()

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function isCandidate(value: unknown): value is Candidate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'check') === 'function'
  )
}

/** The `candidate` a module exports. */
async function loadCandidate(module: string): Promise<Candidate> {
  const loaded: unknown = await import(pathToFileURL(path.resolve(module)).href)
  const found: unknown =
    typeof loaded === 'object' && loaded !== null
      ? Reflect.get(loaded, 'candidate')
      : undefined
  if (!isCandidate(found)) {
    throw new Error(`${module}: no candidate (id, check) exported`)
  }
  return found
}

/** The copy's JSON sections as a migrating shard, with each section's member path. */
function sectionsOf(
  files: Files,
): Readonly<{ shard: MigratingShard; paths: ReadonlyMap<string, string> }> {
  const index = record(readJson(files, INDEX), INDEX)
  const shard = {
    index,
    sections: readSections(files, index),
    mounts: new Map<string, unknown>(),
  }
  const paths = new Map(
    rows(index['sections']).map(
      (row: Readonly<JsonRecord>): [string, string] => [
        String(row['name']),
        String(row['path']),
      ],
    ),
  )
  return { shard, paths }
}

/** Run the candidate's steps over the copy's sections: the ids that changed something, and the rewritten files. */
function candidateCopy(
  files: Files,
  steps: readonly FormatMigration[],
): Readonly<{ applied: readonly string[]; files: Files }> {
  const { shard, paths } = sectionsOf(files)
  const applied = steps.filter((step: Readonly<FormatMigration>): boolean => {
    const before = JSON.stringify([...shard.sections])
    step.apply(shard)
    return JSON.stringify([...shard.sections]) !== before
  })
  const out = new Map(files)
  for (const [name, value] of shard.sections) {
    out.set(
      paths.get(name) ?? `sections/${name}.json`,
      encoder.encode(JSON.stringify(value)),
    )
  }
  return {
    applied: applied.map((step: Readonly<FormatMigration>): string => step.id),
    files: out,
  }
}

/** The current chain's copy, or the reason it cannot run. */
function currentCopy(files: Files): Files | string {
  try {
    return migrateShardfile(files, {
      hash: sha256,
      migrations: FORMAT_MIGRATIONS,
    }).files
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** Judge one original's files under `candidate`. A chain that cannot run fails with its own reason. */
function judgeCandidate(
  files: Files,
  candidate: Readonly<Candidate>,
): CandidateVerdict {
  const copy = currentCopy(files)
  if (typeof copy === 'string') {
    const failures = [{ path: 'chain', reason: copy }]
    return { verdict: 'fails', applied: [], failures }
  }
  const moved = candidateCopy(copy, candidate.migrations ?? [])
  const failures = candidate.check(moved.files)
  if (failures.length > NONE) {
    return { verdict: 'fails', applied: moved.applied, failures }
  }
  const verdict = moved.applied.length > NONE ? 'migrates' : 'valid'
  return { verdict, applied: moved.applied, failures }
}

/** Judge one stored original (brotli unless `plain`) under `candidate`. */
async function candidateVerdict(
  file: string,
  plain: boolean,
  candidate: Readonly<Candidate>,
): Promise<CandidateVerdict> {
  const stored = new Uint8Array(await readFile(file))
  const tar = plain ? stored : new Uint8Array(await unbrotli(stored))
  return judgeCandidate(readTar(tar), candidate)
}

/** The report's text for one verdict: `migrates (steps)` or `fails path reason; …`. */
function candidateText(found: Readonly<CandidateVerdict>): string {
  if (found.verdict === 'fails') {
    const parts = found.failures.map(
      (row: Readonly<CandidateFailure>): string => `${row.path} ${row.reason}`,
    )
    return `fails ${parts.join('; ')}`
  }
  return found.verdict === 'migrates'
    ? `migrates (${found.applied.join(', ')})`
    : 'valid'
}

/** The row field a candidate run adds, or none without a candidate. */
async function candidateField(
  candidate: Readonly<Candidate> | undefined,
  file: string,
  plain: boolean,
): Promise<Readonly<{ candidate?: string }>> {
  if (candidate === undefined) {
    return {}
  }
  const found = await candidateVerdict(file, plain, candidate)
  return { candidate: candidateText(found) }
}

/** Whether a kept original is one `--only` names (`slug`, or `slug@r5`). */
function onlyNamed(
  only: readonly string[] | undefined,
  revisions: readonly Named[],
): boolean {
  return (
    only === undefined ||
    revisions.some(
      (named: Named): boolean =>
        only.includes(named.shard) ||
        only.includes(`${named.shard}@r${String(named.revision)}`),
    )
  )
}

export {
  type Candidate,
  type CandidateFailure,
  type CandidateVerdict,
  candidateField,
  candidateText,
  candidateVerdict,
  judgeCandidate,
  loadCandidate,
  onlyNamed,
}
