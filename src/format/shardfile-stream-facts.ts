// What `inspectBlob` reads from a blob's bytes, taken while the blob streams
// (API-CLOUDFLARE AC6a). A tarball is sorted (J60), so its blobs pass before
// `shard.json` names their declared kinds and costs: the stream keeps these
// facts, drops the bytes, and replays `inspectBlob` once the index is read.
// A parser's refusal is kept as its message only: a live Error can hold its
// blob through the stack it captured (Codex review, AC6a).

import { parseNamedJson } from './json.ts'
import { ktx2DeviceCosts } from './ktx2Cost.ts'
import { validatePlatformFile } from './platformFileFamilies.ts'
import {
  registeredJsonContract,
  validateRegisteredJson,
} from './registeredJson.ts'
import { assetCost } from './shardfile-assets.ts'
import { outputBlobExtension, outputBlobKind } from './shardfileValidation.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { OutputFile } from './outputIndex.ts'
import type { ScriptContract } from './scriptContract.ts'
import type { AssetCost } from './shardfile-assets.ts'

/** A computed value, or the message of the refusal computing it threw: thrown later, in the old validator's order. */
type Outcome<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; message: string }>

/** The facts of one blob, for the kind its path's extension names. */
interface BlobFacts {
  readonly kind: OutputFile['kind']
  readonly sniffed: Outcome<OutputFile['kind']>
  readonly extension: Outcome<string>
  /** Absent for Wasm, whose cost needs its script contract; its bytes are kept instead. */
  readonly cost: Outcome<Readonly<AssetCost>> | undefined
  /** Canonical `ktx2DeviceCosts` text, for KTX2. */
  readonly ktx2: Outcome<string> | undefined
}

/** A blob's or kept file's bytes and facts, as the replay sees them. */
interface FactsMember {
  readonly bytes: Readonly<Uint8Array> | undefined
  readonly facts: BlobFacts | undefined
}

const KINDS: ReadonlyMap<string, OutputFile['kind']> = new Map([
  ['glb', 'glb'],
  ['ktx2', 'ktx2'],
  ['wav', 'audio'],
  ['ogg', 'audio'],
  ['m4a', 'audio'],
  ['mp3', 'audio'],
  ['json', 'json'],
  ['wasm', 'wasm'],
  ['webp', 'image'],
  ['jpg', 'image'],
  ['png', 'image'],
  ['bin', 'bin'],
  ['wtt', 'tile'],
])
const NEXT = 1
const COSTS = ['decoded', 'gpu', 'triangles', 'draws'] as const

function outcome<Value>(run: () => Value): Outcome<Value> {
  try {
    return { ok: true, value: run() }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function settled<Value>(result: Outcome<Value>): Value {
  if (result.ok) {
    return result.value
  }
  throw new Error(result.message)
}

function legacyKind(kind: OutputFile['kind']): string {
  return kind === 'bin' || kind === 'tile' ? 'binary' : kind
}

function ktx2Facts(bytes: Readonly<Uint8Array>): Outcome<string> {
  return outcome((): string =>
    new TextDecoder().decode(validationSourceBytes(ktx2DeviceCosts(bytes))),
  )
}

/** The facts of a blob's bytes, or nothing for a path that names no blob kind. */
function blobFacts(
  path: string,
  bytes: Readonly<Uint8Array>,
): BlobFacts | undefined {
  const kind = KINDS.get(path.slice(path.lastIndexOf('.') + NEXT))
  if (kind === undefined) {
    return undefined
  }
  const legacy = legacyKind(kind)
  return {
    kind,
    sniffed: outcome((): OutputFile['kind'] => outputBlobKind(legacy, bytes)),
    extension: outcome((): string => outputBlobExtension(kind, bytes)),
    cost:
      kind === 'wasm'
        ? undefined
        : outcome((): AssetCost => assetCost(legacy, bytes)),
    ktx2: kind === 'ktx2' ? ktx2Facts(bytes) : undefined,
  }
}

function kindError(): Error {
  return new Error('Output blob bytes differ from their declared kind')
}

function keptBytes(member: FactsMember): Readonly<Uint8Array> {
  if (member.bytes === undefined) {
    throw kindError()
  }
  return member.bytes
}

/** `inspectBlob`'s registered-JSON checks, for a host with no JSON Schema checker (the Worker). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
function inspectRegistered(file: OutputFile, member: FactsMember): void {
  const contract =
    file.name === undefined ? undefined : registeredJsonContract(file.name)
  if (
    contract !== undefined &&
    (file.kind !== 'json' || file.jsonSchema === undefined)
  ) {
    throw new Error('Registered JSON requires its defining schema')
  }
  if (file.jsonSchema === undefined) {
    return
  }
  if (contract === undefined || file.name === undefined) {
    throw new Error(
      'Unregistered named JSON with a schema needs a JSON Schema checker',
    )
  }
  if (file.jsonSchema['$comment'] !== contract.source) {
    throw new Error(
      'Registered JSON requires its exact defining format contract',
    )
  }
  validateRegisteredJson(file.name, parseNamedJson(keptBytes(member)))
}

/** `inspectBlob`'s platform-file check of named JSON. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
function inspectPlatformJson(file: OutputFile, member: FactsMember): void {
  if (file.kind !== 'json' || file.name === undefined) {
    return
  }
  const source = file.jsonSchema?.['$comment']
  const schema = typeof source === 'string' ? source : undefined
  if (
    validatePlatformFile(
      file.name,
      schema,
      parseNamedJson(keptBytes(member)),
    ) === undefined
  ) {
    throw new Error(`Unregistered named JSON: ${file.name}`)
  }
}

/** `inspectBlob` again, from the facts: the same checks in the same order. A declared kind other than the one the
 *  path names fails the kind or extension check, as it does in `inspectBlob` (its message may differ). */
function inspectFacts(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  file: OutputFile,
  member: FactsMember,
  script: Readonly<ScriptContract> | undefined,
): void {
  inspectRegistered(file, member)
  inspectPlatformJson(file, member)
  const { facts } = member
  if (facts?.kind !== file.kind) {
    throw kindError()
  }
  if (
    settled(facts.sniffed) !== file.kind ||
    !file.path.endsWith(`.${settled(facts.extension)}`)
  ) {
    throw kindError()
  }
  const cost =
    facts.cost === undefined
      ? assetCost('wasm', keptBytes(member), script)
      : settled(facts.cost)
  if (
    COSTS.some((key: (typeof COSTS)[number]): boolean => cost[key] > file[key])
  ) {
    throw new Error('Output blob understates parsed costs')
  }
}

/** A KTX2 blob's device-cost text, for `ktx2Costs`. */
function ktx2Text(member: FactsMember | undefined): string | undefined {
  const facts = member?.facts?.ktx2
  return facts === undefined ? undefined : settled(facts)
}

export type { BlobFacts, FactsMember }
export { blobFacts, inspectFacts, ktx2Text }
