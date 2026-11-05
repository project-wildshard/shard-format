import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

// A real product: written by singleplayer's author SDK
// (writeOutputProduct over emptyShardfile, one terrain tile, ui/strings)
// at Raynos/project-wildshard-singleplayer@36d00c6645.
const FIXTURE = fileURLToPath(
  new URL('../test/fixtures/cli-fixture', import.meta.url),
)
const MAIN = fileURLToPath(new URL('main.ts', import.meta.url))
const TILE =
  'blobs/tile/3e3289c52844514d6bc5474ef29c6e6f03f57b9d890ce3c7b936093e093099d0.wtt'

const scratch = mkdtempSync(path.join(tmpdir(), 'shardfile-validate-'))
after((): void => {
  rmSync(scratch, { recursive: true, force: true })
})

function cli(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [MAIN, ...args], { encoding: 'utf8' })
}

function copy(name: string): string {
  const dir = path.join(scratch, name)
  cpSync(FIXTURE, dir, { recursive: true })
  return dir
}

describe('shardfile validate on a good product', (): void => {
  it('passes and names the shard', (): void => {
    const run = cli(['validate', FIXTURE])

    assert.equal(run.stderr, '')
    assert.equal(run.status, 0)
    assert.match(
      run.stdout,
      /^ok cli-fixture r1: 34 sections, 1 assets, source [\da-f]{64}\n$/u,
    )
  })
})

describe('shardfile validate on a broken product', (): void => {
  it('refuses a changed blob', (): void => {
    const dir = copy('changed')
    const bytes = readFileSync(path.join(dir, TILE))
    const changed = bytes.map((byte: number, index: number): number =>
      index === 0 ? 255 - byte : byte,
    )
    writeFileSync(path.join(dir, TILE), changed)
    const run = cli(['validate', dir])

    assert.equal(run.status, 3)
    assert.match(
      run.stderr,
      /is not a valid shardfile: Output hash or size mismatch/u,
    )
  })

  it('refuses a file the index does not list', (): void => {
    const dir = copy('unlisted')
    writeFileSync(path.join(dir, 'extra.js'), 'export {}\n')
    const run = cli(['validate', dir])

    assert.equal(run.status, 3)
    assert.match(run.stderr, /Unlisted output file: extra\.js/u)
  })
})

describe('shardfile validate usage', (): void => {
  it('needs exactly one folder', (): void => {
    const run = cli(['validate'])

    assert.equal(run.status, 1)
    assert.match(run.stderr, /validate takes one folder/u)
  })
})
