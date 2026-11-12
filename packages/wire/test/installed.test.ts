import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
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

function packInputs(dir: string): void {
  checked('pnpm', ['pack', '--pack-destination', dir], ROOT)
  // Frozen installs cache package bytes, not registry metadata. Supply those
  // same pinned bytes locally; an override never invents a missing dependency.
  checked(
    'pnpm',
    ['pack', '--pack-destination', dir],
    path.join(ROOT, '../../node_modules/valibot'),
  )
}

function prepareConsumer(dir: string): string {
  const consumer = path.join(dir, 'consumer')
  mkdirSync(consumer, { recursive: true })
  writeFileSync(path.join(consumer, 'pnpm-workspace.yaml'), 'packages: []\n')
  writeFileSync(
    path.join(consumer, '.npmrc'),
    'node-linker=isolated\npackage-import-method=copy\nenable-global-virtual-store=false\n',
  )
  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@wildshard/wire': 'file:../wildshard-wire-0.0.0.tgz',
      },
      pnpm: { overrides: { valibot: 'file:../valibot-1.5.0.tgz' } },
    }),
  )
  return consumer
}

function checkDependency(installed: string, consumer: string): void {
  const entry = realpathSync(path.join(installed, 'bin.mjs'))
  const dependency = realpathSync(createRequire(entry).resolve('valibot'))
  assert.ok(dependency.startsWith(`${consumer}${path.sep}`), dependency)
}

const IMPORT_CHECKS = [
  "import assert from 'node:assert/strict'; import { WIRE_PACKAGE_VERSION } from '@wildshard/wire/version'; assert.equal(WIRE_PACKAGE_VERSION, '0.0.0')",
  "import assert from 'node:assert/strict'; import { quantiseCommand } from '@wildshard/wire/command'; import { STEER_AXIS_CODEC } from '@wildshard/wire/fixed'; const value=0.5/127; const steer={keyX:value,keyY:0,stickX:0,stickY:0}; assert.equal(quantiseCommand({steer,yaw:0,pitch:0}).steer.keyX, STEER_AXIS_CODEC.decode(STEER_AXIS_CODEC.encode(value)))",
  "import assert from 'node:assert/strict'; import { NetActSchema } from '@wildshard/wire/netCommand'; import { PLAYER } from '@wildshard/wire/classes'; import { v0SchemaHash } from '@wildshard/wire/v0'; assert.equal(PLAYER.id, 1); assert.equal(NetActSchema.type, 'variant'); assert.equal(v0SchemaHash([PLAYER]) > 0, true)",
]

function checkImports(consumer: string): void {
  for (const script of IMPORT_CHECKS) {
    checked(process.execPath, ['--input-type=module', '-e', script], consumer)
  }
}

function install(dir: string): {
  readonly consumer: string
  readonly installed: string
} {
  packInputs(dir)
  const consumer = prepareConsumer(dir)
  const installed = path.join(consumer, 'node_modules/@wildshard/wire')
  const options = [
    'install',
    '--offline',
    '--config.enable-global-virtual-store=false',
    `--store-dir=${path.join(dir, 'store')}`,
    `--config.cache-dir=${path.join(dir, 'metadata')}`,
  ]
  checked('pnpm', [...options, '--no-frozen-lockfile'], consumer)
  checked('pnpm', [...options, '--frozen-lockfile'], consumer)
  checkDependency(installed, consumer)
  checkImports(consumer)
  return { consumer, installed }
}

function checkRefusals(bin: string, consumer: string): void {
  for (const args of [[], ['check', '--unknown'], ['unknown']]) {
    const refused = run(process.execPath, [bin, ...args], consumer)
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /Usage/u)
  }
}

function checkTamperedLock(
  installed: string,
  consumer: string,
  [name, ...args]: readonly string[],
): void {
  const bin = path.join(installed, 'bin.mjs')
  checked(process.execPath, [bin, ...args], consumer)
  const lock = path.join(installed, name ?? '')
  const original = readFileSync(lock, 'utf8')
  writeFileSync(lock, `${original} `)
  assert.equal(run(process.execPath, [bin, ...args], consumer).status, 1)
  writeFileSync(lock, original)
}

function checkInstalledBaseline(installed: string, consumer: string): void {
  checkTamperedLock(installed, consumer, [
    'wire.v0.lock.json',
    'check',
    '--baseline',
  ])
  checkTamperedLock(installed, consumer, ['wire.lock.json', 'check'])
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

function checkWireCommand(bin: string, consumer: string): void {
  const check = run(process.execPath, [bin, 'check'], consumer)
  assert.equal(check.status, 0, check.stderr)
  assert.match(
    check.stdout,
    /lock current; .* 2 added \(player\.name #54, animal\.species #24\)/u,
  )
}

test('the packed package imports and checks inside a real consumer node_modules', (): void => {
  const dir = mkdtempSync(path.join(SCRATCH_ROOT, 'wire-installed-'))
  try {
    const { consumer, installed } = install(dir)
    const bin = path.join(installed, 'bin.mjs')
    checkWireCommand(bin, consumer)
    checkRefusals(bin, consumer)
    checkInstalledBaseline(installed, consumer)
    checkFrozenRefusal(installed, consumer)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
