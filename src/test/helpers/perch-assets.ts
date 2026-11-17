import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { parse } from 'valibot'

import { parseDecisionScripts } from '../../format/decisionScripts.ts'
import { fixture, perch } from '../../format/fixtures/perch-authority.ts'
import { ReturnProgramWireDocumentSchema } from '../../format/returnProgramDocument.ts'
import { assetCost } from '../../format/shardfile-assets.ts'
import { parseShardfile } from '../../format/shardSchema.ts'

import type { ScriptAdmissionRows } from '../../format/scriptContract.ts'
import type { Shardfile } from '../../format/shardSchema.ts'

interface AdmissionFixture {
  readonly shard: Shardfile
  readonly assets: ReadonlyMap<string, Uint8Array>
  readonly scripts: ScriptAdmissionRows
}

function digest(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function jsonFixture(name: string): object {
  const text = readFileSync(
    new URL(`../../format/fixtures/${name}.json`, import.meta.url),
    'utf8',
  )
  const value: unknown = JSON.parse(text)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected fixture object')
  }
  return value
}

/** Real native VM bytes, with distinct valid custom sections for unrelated guests. */
function fixtureBinaries(extraModules: number): Uint8Array[] {
  const program = parse(
    ReturnProgramWireDocumentSchema,
    jsonFixture('perch-return'),
  )
  const bytes = Uint8Array.from(Buffer.from(program.bytes, 'base64'))
  return [
    bytes,
    ...Array.from(
      { length: extraModules },
      (_unused: unknown, index: number): Uint8Array =>
        new Uint8Array([...bytes, 0, 2, 1, 65 + index]),
    ),
  ]
}

function fixtureFile(binary: Readonly<Uint8Array>): Shardfile['files'][number] {
  return {
    hash: digest(binary),
    kind: 'wasm',
    compressed: binary.length,
    ...assetCost('wasm', binary, { abi: 1, pages: 1 }),
    dependencies: [],
    critical: true,
  }
}

function fixtureBudget(
  files: readonly Readonly<{
    decoded: number
    gpu: number
    compressed: number
  }>[],
): Pick<Shardfile, 'budgets' | 'serverBudget'> {
  const resident = files.reduce(
    (sum: number, file: Readonly<{ decoded: number; gpu: number }>): number =>
      sum + file.decoded + file.gpu + 65_536 * 2,
    0,
  )
  return {
    budgets: {
      library: { resident: 0, compressed: 0 },
      overlap: 0,
      sim: {
        resident,
        compressed: files.reduce(
          (sum: number, file: Readonly<{ compressed: number }>): number =>
            sum + file.compressed,
          0,
        ),
      },
    },
    serverBudget: {
      tickMicros: 1000,
      memory: resident,
      entities: 100,
      commandsPerTick: 32,
    },
  }
}

/** Checked empty-world declaration, with real inventoried native VM bytes. */
function admissionFixture(extraModules = 0): AdmissionFixture {
  const program = parse(
    ReturnProgramWireDocumentSchema,
    jsonFixture('perch-return'),
  )
  const binaries = fixtureBinaries(extraModules)
  const files = binaries.map(
    (bytes: Readonly<Uint8Array>): Shardfile['files'][number] =>
      fixtureFile(bytes),
  )
  const shard = parseShardfile({
    ...jsonFixture('perch-world'),
    files,
    ...fixtureBudget(files),
    critical: files.map(
      (file: Readonly<{ hash: string }>): string => file.hash,
    ),
    creatures: {
      ...fixture(),
      perchBodies: [{ ...perch, program: { ...program, bytes: '' } }],
    },
  })
  const scripts = parseDecisionScripts(
    files
      .slice(1)
      .map((file: Readonly<{ hash: string }>, index: number): object => {
        const row = structuredClone(program.script)
        row.id = `fixture.extra.${index}`
        row.module = `blobs/wasm/${file.hash}.wasm`
        return row
      }),
  )
  return {
    shard,
    scripts,
    assets: new Map(
      binaries.map((bytes: Readonly<Uint8Array>): [string, Uint8Array] => [
        digest(bytes),
        Uint8Array.from(bytes),
      ]),
    ),
  }
}

export { admissionFixture, digest, fixtureBudget, jsonFixture }
