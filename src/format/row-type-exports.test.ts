import ts from '@typescript/typescript6'
import { expect, test } from 'vitest'

// SHARD-COMPAT SI3: shards name a mover's collider box and a species' body dims from the format, not from engine's
// `physics/mover` and `entities/species/registry`. Each named type is exactly the row it names.
const consumer = ts.sys.resolvePath('src/format/si3-row-type-consumer.ts')
const options: ts.CompilerOptions = {
  exactOptionalPropertyTypes: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  noUncheckedIndexedAccess: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  types: [],
}
const base = `import type { MoverBox, MoverData } from './movers';
import type { AnimalDims } from './creatures';
import type { ShardRows } from './rows';
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const box: Same<MoverBox, MoverData[number]['boxes'][number]> = true;
export const dims: Same<AnimalDims, ShardRows['species'][number]['dims']> = true;
export const deck: MoverBox = { x: 0, y: -1, z: 0, hx: 4, hy: 1, hz: 1, rot: { x: 0, y: 0, z: 0, w: 1 } };
export const body: AnimalDims = { bodyY: 1, bodyHalfLen: 0.6, bodyRadius: 0.4, headRadius: 0.2, legLen: 0.5,
  feet: [[0.2, 0.4], [-0.2, 0.4], [0.2, -0.4], [-0.2, -0.4]], halfWidth: 0.3 };
`
const MISSING_PROPERTY = 2741

function readSource(
  source: string,
  read: (file: string) => string | undefined,
): (file: string) => string | undefined {
  return (file: string): string | undefined =>
    file === consumer ? source : read(file)
}

function consumerHost(source: string): ts.CompilerHost {
  const host = ts.createCompilerHost(options)
  const exists = host.fileExists.bind(host)
  host.readFile = readSource(source, host.readFile.bind(host))
  host.fileExists = (file: string): boolean => file === consumer || exists(file)
  return host
}

function diagnosticCodes(source: string): number[] {
  const host = consumerHost(source)
  const program = ts.createProgram([consumer], options, host)
  const file = program.getSourceFile(consumer)
  if (file === undefined) {
    throw new Error('Missing virtual SI3 consumer')
  }
  const codes: number[] = []
  for (const diagnostic of program.getSemanticDiagnostics(file)) {
    codes.push(diagnostic.code)
  }
  return codes
}

test('MoverBox and AnimalDims are exactly the mover box and species dims rows', (): void => {
  expect(diagnosticCodes(base)).toEqual([])
})

test('a box without its rotation and dims without feet are refused', (): void => {
  const refused =
    diagnosticCodes(`${base}export const flat: MoverBox = { x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1 };
export const footless: AnimalDims = { bodyY: 1, bodyHalfLen: 1, bodyRadius: 1, headRadius: 1, legLen: 1, halfWidth: 1 };
`)
  expect(
    refused.filter((code: number): boolean => code === MISSING_PROPERTY),
  ).toHaveLength(2)
})
