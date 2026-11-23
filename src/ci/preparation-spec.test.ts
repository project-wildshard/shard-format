// SHARD-COMPAT PR4 (J487): a file prepared to spec 4 at format 0.1.0.3 records the spec in `preparation` and names
// no engine: no renderer fingerprint, programs with no engine build.
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { readCookData } from '../format/cook-data.ts'
import { cookPreparationBytes } from '../format/cook-preparation.ts'
import {
  assembleOutputShardfile,
  parseOutputIndex,
} from '../format/outputIndex.ts'
import { validationSourceBytes } from '../format/validationReceipt.ts'
import { outputIndexEnvelope } from '../format/version.ts'
import { cli, scratch, sha256, CORPUS } from '../test/helpers/corpus.ts'

import type { CookMount } from '../format/cook-data.ts'
import type { OutputIndex } from '../format/outputIndex.ts'

const dir = scratch('preparation-spec')
const PROGRAMS = {
  version: 3,
  lines: ['void main() {}'],
  shaders: [[0]],
  programs: [[0, 0]],
} as const

function readJson(folder: string, name: string): unknown {
  return JSON.parse(readFileSync(path.join(folder, name), 'utf8'))
}

function readRecord(folder: string, name: string): Record<string, unknown> {
  const value = readJson(folder, name)
  assert.ok(typeof value === 'object' && value !== null)
  return { ...value }
}

function writeJson(folder: string, name: string, value: unknown): Uint8Array {
  const bytes = validationSourceBytes(value)
  mkdirSync(path.dirname(path.join(folder, name)), { recursive: true })
  writeFileSync(path.join(folder, name), bytes)
  return bytes
}

const SPEC_FORMAT = '0.1.0.3'

/** FP26a: a 0.1.0.3 file hashes its identity as written, `revision`, not the read-side `saveRevision`. */
function asWrittenIdentity(source: object): object {
  const identity: unknown = Reflect.get(source, 'identity')
  if (typeof identity !== 'object' || identity === null) {
    return source
  }
  const { saveRevision, ...rest } = { ...identity } as Record<string, unknown>
  return saveRevision === undefined
    ? source
    : { ...source, identity: { ...rest, revision: saveRevision } }
}

/** The corpus index in the 0.1.0.3 envelope at spec 4, its source hash re-bound to the new index. */
function specIndex(folder: string): Readonly<OutputIndex> {
  const raw = outputIndexEnvelope({
    ...readRecord(folder, 'shard.json'),
    version: SPEC_FORMAT,
    preparation: 4,
    cook: { path: 'cook.json', hash: '0'.repeat(64), bytes: 0 },
  })
  const parsed = parseOutputIndex(raw)
  const sections = new Map(
    parsed.sections.map(
      (row: Readonly<{ name: string; path: string }>): [string, unknown] => [
        row.name,
        readJson(folder, row.path),
      ],
    ),
  )
  const source = assembleOutputShardfile(raw, sections)
  const sourceHash = sha256(validationSourceBytes(asWrittenIdentity(source)))
  return parseOutputIndex({ ...raw, build: { ...parsed.build, sourceHash } })
}

function programMount(folder: string, slug: string): CookMount {
  const url = `/programs/${slug}.json`
  const bytes = writeJson(folder, `mounts${url}`, PROGRAMS)
  return {
    url,
    path: `mounts${url}`,
    hash: sha256(bytes),
    bytes: bytes.length,
  }
}

function writeCook(
  folder: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot output, only read
  index: Readonly<OutputIndex>,
  cook: Readonly<Record<string, unknown>>,
): void {
  const bytes = writeJson(folder, 'cook.json', cook)
  writeJson(folder, 'shard.json', {
    ...index,
    cook: { path: 'cook.json', hash: sha256(bytes), bytes: bytes.length },
  })
}

function preparedSpec4(name: string): string {
  const folder = path.join(dir, name)
  cpSync(CORPUS, folder, { recursive: true })
  const index = specIndex(folder)
  const { mounts: legacy } = readCookData(readJson(folder, 'cook.json'))
  const mounts = [...legacy, programMount(folder, index.identity.slug)]
  const inputHash = sha256(cookPreparationBytes(index, mounts))
  writeCook(folder, index, {
    version: 4,
    mounts,
    packs: 'whole',
    fence: [],
    inputHash,
    programs: PROGRAMS,
  })
  return folder
}

test('PR4: a spec 4 file validates, reads its spec back and names no engine version', (): void => {
  const folder = preparedSpec4('spec4')
  const run = cli(['validate', folder])
  assert.equal(run.status, 0, run.stderr)
  const index = parseOutputIndex(readJson(folder, 'shard.json'))
  assert.equal(index.preparation, 4)
  assert.equal(index.sdk, undefined)
  const cook = readFileSync(path.join(folder, 'cook.json'), 'utf8')
  assert.doesNotMatch(cook, /"renderer"|"build"/u)
})

test('PR4: an index naming another spec than cook.json is refused, naming both', (): void => {
  const folder = preparedSpec4('spec4-mismatch')
  const index = parseOutputIndex(readJson(folder, 'shard.json'))
  writeJson(folder, 'shard.json', { ...index, preparation: 3 })
  const run = cli(['validate', folder])
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /names preparation spec 3, cook\.json is spec 4/u)
})

test('PR4: a spec 4 cook.json carrying a renderer is refused', (): void => {
  const folder = preparedSpec4('spec4-renderer')
  const index = parseOutputIndex(readJson(folder, 'shard.json'))
  writeCook(folder, index, {
    ...readRecord(folder, 'cook.json'),
    renderer: '1'.repeat(64),
  })
  assert.notEqual(cli(['validate', folder]).status, 0)
})
