// oxlint-disable import/max-dependencies -- pack, the validator and the receipt formula, side by side
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { createHash } from 'node:crypto'
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

import { receiptCost } from '../format/receipt-cost.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import { validateShardfileFolder } from '../format/shardfileValidation.ts'
import {
  shardfileWireBytes,
  publishedSourceResidency,
} from '../format/sourceResidency.ts'
import { readTar } from '../format/tar.ts'
import { packFolder } from './pack.ts'
import { memoryFiles } from './validate.ts'

// Brasscap rev 3 was packed with a receipt that kept its old memory figure:
// 2,930,740 bytes over 4,670,827 bytes of files. A pack measures every
// receipt figure again, from the product it admits.

const FIXTURE = fileURLToPath(
  new URL('../test/fixtures/cli-fixture', import.meta.url),
)
const MAIN = fileURLToPath(new URL('main.ts', import.meta.url))
const RECEIPT = 'validation.json'
const STALE = {
  residentBytes: 1,
  worst: { playing: 0, loading: 0, accounted: 0, location: [0, 0] },
}

const scratch = mkdtempSync(path.join(tmpdir(), 'shardfile-pack-'))
after((): void => {
  rmSync(scratch, { recursive: true, force: true })
})

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function cli(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [MAIN, ...args], { encoding: 'utf8' })
}

/** The fixture, its receipt's figures set too low. */
function stale(name: string): string {
  const dir = path.join(scratch, name)
  cpSync(FIXTURE, dir, { recursive: true })
  const file = path.join(dir, RECEIPT)
  const receipt: unknown = JSON.parse(readFileSync(file, 'utf8'))
  assert.ok(typeof receipt === 'object' && receipt !== null)
  writeFileSync(file, `${JSON.stringify({ ...receipt, ...STALE })}\n`)
  return dir
}

function receiptOf(files: ReadonlyMap<string, Uint8Array>): object {
  const bytes = files.get(RECEIPT)
  assert.ok(bytes !== undefined)
  const receipt: unknown = JSON.parse(new TextDecoder().decode(bytes))
  assert.ok(typeof receipt === 'object' && receipt !== null)
  return receipt
}

describe('shardfile pack restamps a receipt', (): void => {
  it('measures a too-low memory figure again', async (): Promise<void> => {
    const out = path.join(scratch, 'restamped.tar')
    await packFolder(stale('restamped'), out)
    const files = readTar(readFileSync(out))
    await prepareAssetDecoders()
    const product = validateShardfileFolder(memoryFiles(files), {
      hash: sha256,
    })
    const receipt = receiptOf(files)
    const resident = publishedSourceResidency(product.shard)

    assert.ok(resident > shardfileWireBytes(product.shard))
    assert.deepEqual(receipt, {
      ...receipt,
      ...receiptCost(product.shard, product.assets),
    })
    assert.equal(Reflect.get(receipt, 'residentBytes'), resident)
  })

  it('writes the receipt sharddev wrote for an unchanged product', async (): Promise<void> => {
    const out = path.join(scratch, 'unchanged.tar')
    const dir = path.join(scratch, 'unchanged')
    cpSync(FIXTURE, dir, { recursive: true })
    await packFolder(dir, out)
    const held = readTar(readFileSync(out)).get(RECEIPT)

    assert.deepEqual(held, readFileSync(path.join(FIXTURE, RECEIPT)))
  })
})

describe('shardfile validate reads the receipt', (): void => {
  it('warns of a memory figure below the files', (): void => {
    const run = cli(['validate', stale('warned')])

    assert.equal(run.stderr, '')
    assert.equal(run.status, 0)
    assert.match(
      run.stdout,
      /^warning: validation\.json residentBytes 1 is below the product's \d+ bytes of files/mu,
    )
  })

  it('warns of a receipt it cannot read, and still passes', (): void => {
    const dir = path.join(scratch, 'unreadable')
    cpSync(FIXTURE, dir, { recursive: true })
    writeFileSync(path.join(dir, RECEIPT), '{not json')
    const run = cli(['validate', dir])

    assert.equal(run.status, 0)
    assert.match(run.stdout, /^warning: validation\.json is unreadable/mu)
  })
})
