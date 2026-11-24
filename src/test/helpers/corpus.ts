import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after } from 'node:test'
import { fileURLToPath } from 'node:url'

import { memoryFiles } from '../../cli/validate.ts'
import { prepareAssetDecoders } from '../../format/shardfile-assets.ts'
import { validateShardfileFolder } from '../../format/shardfileValidation.ts'

// The product these tests hold: the made-up CLI product (ZONE-SNAPSHOTS ZS5,
// J507: no stored zone). The real folder, the real bin, a temp folder that
// goes when the file's tests end.

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
/** A whole made-up folder (format 0.1): one terrain tile, ui strings, empty sections. */
const CORPUS = path.join(ROOT, 'src/test/fixtures/cli-fixture')
const BIN = path.join(ROOT, 'src/cli/bin.mjs')

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function cli(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' })
}

function scratch(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `shardfile-${name}-`))
  after((): void => {
    rmSync(dir, { recursive: true, force: true })
  })
  return dir
}

/** The host's check, in this process: a parser's crash reaches the test. */
async function validateHere(
  files: ReadonlyMap<string, Readonly<Uint8Array>>,
): Promise<void> {
  await prepareAssetDecoders()
  validateShardfileFolder(memoryFiles(files), { hash: sha256 })
}

export { CORPUS, ROOT, cli, scratch, sha256, validateHere }
