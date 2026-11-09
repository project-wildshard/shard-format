import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCRATCH_ROOT = fileURLToPath(new URL('../../../tmp/', import.meta.url))
mkdirSync(SCRATCH_ROOT, { recursive: true })

function run(
  command: string,
  args: readonly string[],
  cwd: string,
): SpawnSyncReturns<string> {
  return spawnSync(command, [...args], { cwd, encoding: 'utf8' })
}

function checked(command: string, args: readonly string[], cwd: string): void {
  const result = run(command, args, cwd)
  assert.equal(result.status, 0, result.stderr + result.stdout)
}

function install(dir: string): {
  readonly consumer: string
  readonly installed: string
} {
  checked('pnpm', ['pack', '--pack-destination', dir], ROOT)
  const consumer = path.join(dir, 'consumer')
  const installed = path.join(consumer, 'node_modules/@wildshard/wire')
  mkdirSync(installed, { recursive: true })
  checked(
    'tar',
    [
      '-xzf',
      path.join(dir, 'wildshard-wire-0.0.0.tgz'),
      '-C',
      installed,
      '--strip-components',
      '1',
    ],
    ROOT,
  )
  checked(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import assert from 'node:assert/strict'; import { WIRE_PACKAGE_VERSION } from '@wildshard/wire/version'; assert.equal(WIRE_PACKAGE_VERSION, '0.0.0')",
    ],
    consumer,
  )
  return { consumer, installed }
}

function checkRefusals(bin: string, consumer: string): void {
  for (const args of [[], ['check', '--unknown'], ['unknown']]) {
    const refused = run(process.execPath, [bin, ...args], consumer)
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /Usage/u)
  }
}

function checkInstalledBaseline(installed: string, consumer: string): void {
  const bin = path.join(installed, 'bin.mjs')
  checked(process.execPath, [bin, 'check', '--baseline'], consumer)
  const lock = path.join(installed, 'wire.lock.json')
  const original = readFileSync(lock, 'utf8')
  writeFileSync(lock, `${original} `)
  assert.equal(
    run(process.execPath, [bin, 'check', '--baseline'], consumer).status,
    1,
  )
  writeFileSync(lock, original)
}

function checkFrozenRefusal(installed: string, consumer: string): void {
  const source = path.join(installed, 'frozen/v0/bits.ts')
  const original = readFileSync(source, 'utf8')
  writeFileSync(source, `${original}\n`)
  const result = run(
    process.execPath,
    [path.join(installed, 'bin.mjs'), 'check', '--baseline'],
    consumer,
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Frozen v0 input changed: bits.ts/u)
  writeFileSync(source, original)
}

function checkEmptyCommand(bin: string, consumer: string): void {
  const check = run(process.execPath, [bin, 'check'], consumer)
  assert.equal(check.status, 0, check.stderr)
  assert.match(check.stdout, /scaffold only/u)
}

test('the packed package imports and checks inside a real consumer node_modules', (): void => {
  const dir = mkdtempSync(path.join(SCRATCH_ROOT, 'wire-installed-'))
  try {
    const { consumer, installed } = install(dir)
    const bin = path.join(installed, 'bin.mjs')
    checkEmptyCommand(bin, consumer)
    checkRefusals(bin, consumer)
    checkInstalledBaseline(installed, consumer)
    checkFrozenRefusal(installed, consumer)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
