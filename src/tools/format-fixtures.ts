import assert from 'node:assert/strict'
// SHARD-COMPAT CP1 and FE11: the corpus/format-versions fixtures, shared by the chain test and the per-step goldens.
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { migrateShardfile } from '../format/format-migrate.ts'

type Files = ReadonlyMap<string, Uint8Array>
/** One fixture (ZONE-SNAPSHOTS ZS4, J507: made-up files only, never a stored zone): a folder at the version, or a
 * made-up folder carried up to the version by the chain. */
interface Fixture {
  readonly folder?: string
  /** A made-up folder's migrated copy at this version: the chain's own output there. */
  readonly madeUp?: string
}

const ROOT = path.resolve(import.meta.dirname, '../..')
const VERSIONS = path.join(ROOT, 'corpus/format-versions')
const NONE = 0

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function folderFiles(folder: string): Promise<Files> {
  const root = path.join(ROOT, folder)
  const files = new Map<string, Uint8Array>()
  for (const entry of await readdir(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = path.join(entry.parentPath, entry.name)
      // eslint-disable-next-line no-await-in-loop -- a fixture folder is small
      const bytes = new Uint8Array(await readFile(absolute))
      files.set(path.relative(root, absolute).split(path.sep).join('/'), bytes)
    }
  }
  return files
}

async function fixtureFiles(
  fixture: Readonly<Fixture>,
  version: string,
): Promise<Files> {
  if (fixture.folder !== undefined) {
    return await folderFiles(fixture.folder)
  }
  if (fixture.madeUp === undefined) {
    throw new Error('A fixture names a folder or a made-up folder')
  }
  return migrateShardfile(await folderFiles(fixture.madeUp), {
    hash: sha256,
    to: version,
  }).files
}

async function fixtures(version: string): Promise<readonly Fixture[]> {
  const text = await readFile(
    path.join(VERSIONS, version, 'fixtures.json'),
    'utf8',
  )
  const parsed: unknown = JSON.parse(text)
  const list: unknown =
    typeof parsed === 'object' && parsed !== null
      ? Reflect.get(parsed, 'fixtures')
      : undefined
  assert.ok(
    Array.isArray(list) && list.length > NONE,
    `format ${version} has no fixture`,
  )
  return list.filter(
    (row: unknown): row is Fixture => typeof row === 'object' && row !== null,
  )
}

export {
  ROOT,
  VERSIONS,
  type Files,
  type Fixture,
  fixtureFiles,
  fixtures,
  sha256,
}
