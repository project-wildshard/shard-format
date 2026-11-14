// oxlint-disable import/max-dependencies -- the old validator's steps, each from its defining module
// `validateShardfileFolder`'s inventory steps, replayed over what one
// streaming pass kept (API-CLOUDFLARE AC6a): each listed file's hash and
// size, the blobs' facts, server files, KTX2 device costs, the cook and its
// mounts, and no unlisted file. The order and the messages are the old ones.
// The index and script rows are valibot's output types, which the replay only
// reads; their parameters say so in a disable comment rather than a deep type.

import { cookMountPath, readCookData } from './cook-data.ts'
import { requireCookPreparation } from './cook-preparation.ts'
import { issueError, withIssueCode } from './issue-codes.ts'
import { validatePlatformFile } from './platformFileFamilies.ts'
import { decisionModuleContracts } from './scriptContract.ts'
import { mountSharesBlob } from './shardfile-reads.ts'
import { inspectFacts, ktx2Text } from './shardfile-stream-facts.ts'
import { outputBlobKind, readCanonicalJson } from './shardfileValidation.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { OutputIndex } from './outputIndex.ts'
import type { ScriptAdmissionRows } from './scriptContract.ts'
import type { FactsMember } from './shardfile-stream-facts.ts'
import type { StreamMember } from './shardfile-stream-tar.ts'

/** One tar member after the walk. */
type KeptMember = FactsMember & StreamMember

interface Listed {
  readonly path: string
  readonly hash: string
  readonly bytes: number
}

/** The members the walk kept, and the paths the replay has listed so far. */
interface Replay {
  readonly members: ReadonlyMap<string, KeptMember>
  readonly listed: Set<string>
  readonly hash: (bytes: Readonly<Uint8Array>) => string
}

const NONE = 0

/** A listed file: present, no larger than declared, and of its exact hash and size. */
function readListed(
  replay: Readonly<Replay>,
  entry: Readonly<Listed>,
): KeptMember {
  replay.listed.add(entry.path)
  const member = replay.members.get(entry.path)
  if (member === undefined) {
    throw issueError('file-mismatch', `missing file: ${entry.path}`)
  }
  if (member.size > entry.bytes) {
    throw issueError(
      'file-mismatch',
      `larger than its declared size: ${entry.path}`,
    )
  }
  if (member.size !== entry.bytes || member.sha !== entry.hash) {
    throw issueError(
      'file-mismatch',
      `Output hash or size mismatch: ${entry.path}`,
    )
  }
  return member
}

/** A listed file's kept bytes. */
function listedBytes(
  replay: Readonly<Replay>,
  entry: Readonly<Listed>,
): Uint8Array {
  const { bytes } = readListed(replay, entry)
  if (bytes === undefined) {
    throw issueError('stream-miss', `stream: ${entry.path} was not kept`)
  }
  return bytes
}

/** Every listed blob through `inspectBlob`'s checks; the members by asset key, for `ktx2Costs`. */
function replayFiles(
  replay: Readonly<Replay>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's row type, only read
  scripts: ScriptAdmissionRows,
): Map<string, KeptMember> {
  const contracts = withIssueCode(
    'script-admission',
    (): ReturnType<typeof decisionModuleContracts> =>
      decisionModuleContracts(scripts, index.files),
  )
  const assets = new Map<string, KeptMember>()
  for (const entry of index.files) {
    const member = readListed(replay, {
      path: entry.path,
      hash: entry.hash,
      bytes: entry.compressed,
    })
    withIssueCode('blob-invalid', (): void => {
      inspectFacts(
        entry,
        member,
        entry.kind === 'wasm'
          ? (contracts.get(entry.hash) ?? { abi: 0 })
          : undefined,
      )
    })
    assets.set(
      `${entry.commons === true ? 'commons:' : ''}${entry.hash}`,
      member,
    )
    if (index.requires.commons.includes(entry.hash)) {
      assets.set(`commons:${entry.hash}`, member)
    }
  }
  return assets
}

/** J91's server files, and the declared KTX2 device costs against the verified bytes. */
function replayServerAndKtx2(
  replay: Readonly<Replay>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  assets: ReadonlyMap<string, KeptMember>,
): void {
  for (const entry of index.admission.server ?? []) {
    const bytes = listedBytes(replay, entry)
    withIssueCode('server-file-invalid', (): void => {
      if (entry.kind === 'json') {
        if (
          validatePlatformFile(
            entry.name,
            entry.schema,
            readCanonicalJson(bytes),
          ) === undefined
        ) {
          throw new Error(`Unregistered named JSON: ${entry.name}`)
        }
      } else if (outputBlobKind('binary', bytes) !== entry.kind) {
        throw new Error('Output blob bytes differ from their declared kind')
      }
    })
  }
  for (const [hash, cost] of Object.entries(index.ktx2Costs ?? {})) {
    const actual = withIssueCode('ktx2-costs', (): string | undefined =>
      ktx2Text(assets.get(hash)),
    )
    if (
      actual === undefined ||
      new TextDecoder().decode(validationSourceBytes(cost)) !== actual
    ) {
      throw issueError(
        'ktx2-costs',
        'KTX2 device costs differ from verified bytes',
      )
    }
  }
}

/** The cook steps `replayCook` tags. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
function cookSteps(replay: Readonly<Replay>, index: OutputIndex): void {
  const cook =
    index.cook === undefined
      ? undefined
      : readCookData(readCanonicalJson(listedBytes(replay, index.cook)))
  requireCookPreparation(index, cook, replay.hash)
  for (const mount of cook?.mounts ?? []) {
    if (!mountSharesBlob(mount, index.files)) {
      if (mount.path !== cookMountPath(mount.url)) {
        throw new Error(`Mount path differs from its URL: ${mount.url}`)
      }
      readListed(replay, mount)
    }
  }
}

/** C0 (J137): the cook file, and each mount's hash and size. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
function replayCook(replay: Readonly<Replay>, index: OutputIndex): void {
  withIssueCode('cook-invalid', (): void => {
    cookSteps(replay, index)
  })
}

/** No copied runtime files (the Worker has no import checker) and no file the index does not list. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
function replayInventory(replay: Readonly<Replay>, index: OutputIndex): void {
  if ((index.runtime?.files ?? []).length > NONE) {
    throw issueError(
      'runtime-files',
      'Copied runtime files need a runtime import checker',
    )
  }
  for (const path of replay.members.keys()) {
    if (!replay.listed.has(path)) {
      throw issueError('unlisted-file', `Unlisted output file: ${path}`)
    }
  }
}

/** The steps from the blobs to the KTX2 costs, before the packs. */
function replayBeforePacks(
  replay: Readonly<Replay>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's row type, only read
  scripts: ScriptAdmissionRows,
): void {
  replayServerAndKtx2(replay, index, replayFiles(replay, index, scripts))
}

/** `checkPacks` in pack order, from what the later reads found; then the cook, its mounts and the inventory. */
function replayPacksToInventory(
  replay: Readonly<Replay>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  packs: ReadonlyMap<string, string | undefined>,
): void {
  for (const pack of index.packs ?? []) {
    if (replay.members.has(pack.path)) {
      readListed(replay, pack)
    }
    const refusal = packs.get(pack.path)
    if (refusal !== undefined) {
      throw issueError('pack-invalid', refusal)
    }
  }
  replayCook(replay, index)
  replayInventory(replay, index)
}

export type { KeptMember, Replay }
export { listedBytes, replayBeforePacks, replayPacksToInventory }
