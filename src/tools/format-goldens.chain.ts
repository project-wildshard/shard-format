// SHARD-COMPAT FE11: a golden per fixture per migration. Each corpus/format-versions fixture runs the chain one step
// through the chain; the digest of its JSON after every step (index, sections, mounts) is pinned in
// corpus/format-goldens.json. A step whose output changes fails here, naming the fixture and the step.
// `node src/tools/format-goldens.chain.ts --write` rewrites the goldens after a deliberate change.
// oxlint-disable typescript/prefer-readonly-parameter-types -- the chain hands each step's shard (maps) to the hook
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { before, test } from 'node:test'

import { migrateShardfile } from '../format/format-migrate.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import {
  ROOT,
  VERSIONS,
  fixtureFiles,
  fixtures,
  sha256,
} from './format-fixtures.ts'

import type { MigratingShard } from '../format/format-migrations.ts'
import type { Files, Fixture } from './format-fixtures.ts'

type Goldens = Record<string, Record<string, string>>

const GOLDENS = path.join(ROOT, 'corpus/format-goldens.json')
const WRITE_FLAG = '--write'
const ARGS = 2
const INDENT = 1

function labelOf(version: string, fixture: Readonly<Fixture>): string {
  return `${version} ${fixture.folder ?? fixture.chainOf ?? fixture.pin?.slug ?? '?'}`
}

/** A map's entries, by key. */
function byKey(map: ReadonlyMap<string, unknown>): unknown[] {
  return [...map].toSorted(([one], [two]): number => one.localeCompare(two))
}

/** The shard's JSON (index, sections, mounts) as one canonical string. */
function shardText(shard: Readonly<MigratingShard>): string {
  return JSON.stringify([
    shard.index,
    byKey(shard.sections),
    byKey(shard.mounts),
  ])
}

/** The digest of the shard's JSON after each step the chain runs on the fixture. */
function stepDigests(files: Files): Record<string, string> {
  const digests: Record<string, string> = {}
  migrateShardfile(files, {
    hash: sha256,
    onStep: (id: string, shard: Readonly<MigratingShard>): void => {
      digests[id] = sha256(new TextEncoder().encode(shardText(shard)))
    },
  })
  return digests
}

async function allDigests(): Promise<Goldens> {
  const goldens: Goldens = {}
  const listed = await readdir(VERSIONS)
  const versions = listed.toSorted()
  for (const version of versions) {
    // eslint-disable-next-line no-await-in-loop -- one shard file in memory at a time
    for (const fixture of await fixtures(version)) {
      // eslint-disable-next-line no-await-in-loop -- one shard file in memory at a time
      const files = await fixtureFiles(fixture, version)
      goldens[labelOf(version, fixture)] = stepDigests(files)
    }
  }
  return goldens
}

const [flag] = process.argv.slice(ARGS)

if (flag === WRITE_FLAG) {
  await prepareAssetDecoders()
  await writeFile(
    GOLDENS,
    `${JSON.stringify(await allDigests(), undefined, INDENT)}\n`,
  )
} else {
  before(async (): Promise<void> => {
    await prepareAssetDecoders()
  })

  test('every fixture matches its golden after every migration step (FE11)', async (): Promise<void> => {
    const text = await readFile(GOLDENS, 'utf8')
    const pinned: unknown = JSON.parse(text)
    assert.deepEqual(await allDigests(), pinned)
  })
}
