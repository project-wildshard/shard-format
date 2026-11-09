import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { object, parse, record, string } from 'valibot'

import GOLDENS from '../fixtures/v0.json' with { type: 'json' }
import CONTRACTS from '../frozen/v0/contracts.json' with { type: 'json' }
import { NET_EVENT_FORMS } from '../frozen/v0/messages.ts'
import { netSchemaHash } from '../frozen/v0/schema.ts'
import TABLES from '../frozen/v0/tables.json' with { type: 'json' }
import { V0_DESCRIPTIONS, V0_SCHEMAS } from '../frozen/v0/tables.ts'
import { reencodeGolden } from './golden-codec.ts'

import type { NetField, NetSchema, NetSend } from '../frozen/v0/schema.ts'

const FIELD_ID_OFFSET = 1
const LOCK_VERSION = 0
const JSON_INDENT = 2
const FrozenFile = object({ frozenSha256: string() })
const FrozenFiles = record(string(), FrozenFile)
const Provenance = object({ files: FrozenFiles })
type LockedField = Readonly<
  Omit<NetField<never>, 'read' | 'predicted' | 'send'>
> & {
  readonly id: number
  readonly order: number
  readonly name: string
  readonly send: NetSend
  readonly predicted: boolean
}
interface LockedClass {
  readonly v0Index: number
  readonly v1Id: number
  readonly name: string
  readonly fields: readonly LockedField[]
}

function lockField(
  [name, field]: readonly [string, NetField<never>],
  order: number,
): LockedField {
  const { read, ...spec } = field
  void read
  return {
    id: order + FIELD_ID_OFFSET,
    order,
    name,
    ...spec,
    send: field.send ?? 'all',
    predicted: field.predicted === true,
  }
}

function lockClass(schema: NetSchema<never>, index: number): LockedClass {
  return {
    v0Index: index,
    v1Id: index + FIELD_ID_OFFSET,
    name: schema.cls,
    fields: Object.entries(schema.fields).map(
      (entry: readonly [string, NetField<never>], order: number): LockedField =>
        lockField(entry, order),
    ),
  }
}

/** Rebuild the v0 lock from frozen declarations, preserving field order. */
function baselineLockText(): string {
  return `${JSON.stringify(
    {
      version: LOCK_VERSION,
      engine: TABLES.engine,
      schemaHash: netSchemaHash([...V0_DESCRIPTIONS, NET_EVENT_FORMS]),
      hashAlgorithm:
        'engine fnv1a32(class descriptions joined with event forms)',
      descriptions: V0_DESCRIPTIONS,
      eventForms: NET_EVENT_FORMS,
      classes: V0_SCHEMAS.map(
        (schema: NetSchema<never>, index: number): LockedClass =>
          lockClass(schema, index),
      ),
      ...CONTRACTS,
      columns: TABLES.columns,
    },
    undefined,
    JSON_INDENT,
  )}\n`
}

/** Refuse edits to frozen inputs before trusting their derived lock. */
async function verifyFrozenFiles(): Promise<void> {
  const text = await readFile(
    new URL('../../frozen/v0/provenance.json', import.meta.url),
    'utf8',
  )
  const manifest = parse(Provenance, JSON.parse(text))
  const tasks = Object.entries(manifest.files).map(
    async ([name, expected]: readonly [
      string,
      { readonly frozenSha256: string },
    ]): Promise<void> => {
      const bytes = await readFile(
        new URL(`../../frozen/v0/${name}`, import.meta.url),
      )
      const digest = createHash('sha256').update(bytes).digest('hex')
      if (digest !== expected.frozenSha256) {
        throw new Error(`Frozen v0 input changed: ${name}`)
      }
    },
  )
  await Promise.all(tasks)
}

/** Captured from the original engine, including its malformed refusals. */
function verifyGoldens(): void {
  for (const fixture of GOLDENS.fixtures) {
    const encoded = reencodeGolden(
      fixture.stream,
      Buffer.from(fixture.hex, 'hex'),
    )
    if (
      encoded === undefined ||
      Buffer.from(encoded).toString('hex') !== fixture.hex
    ) {
      throw new Error(`Frozen golden differs: ${fixture.name}`)
    }
  }
  for (const fixture of GOLDENS.malformed) {
    if (
      reencodeGolden(fixture.stream, Buffer.from(fixture.hex, 'hex')) !==
      undefined
    ) {
      throw new Error(`Malformed golden accepted: ${fixture.name}`)
    }
  }
}

/** WS2 only: no v1 compatibility or release classification is claimed. */
async function checkBaseline(): Promise<void> {
  await verifyFrozenFiles()
  verifyGoldens()
  if (
    netSchemaHash([...V0_DESCRIPTIONS, NET_EVENT_FORMS]) !== TABLES.schemaHash
  ) {
    throw new Error('Frozen schema hash differs from engine cfd6681')
  }
  const recorded = await readFile(
    new URL('../../wire.lock.json', import.meta.url),
    'utf8',
  )
  if (baselineLockText() !== recorded) {
    throw new Error('wire.lock.json differs from the frozen v0 baseline')
  }
}

export { baselineLockText, checkBaseline }
