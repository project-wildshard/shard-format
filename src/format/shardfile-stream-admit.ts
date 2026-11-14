// `admitShardfileFolder`'s steps around `validateShardfileAssets` for the
// streaming validator (API-CLOUDFLARE AC6a): the schema, declared costs and
// targets before it; the world targets and the source hash after it.

import {
  admitAfterFiles,
  admitCommonsBytes,
  assetAdmission,
  preflightDeclaredCosts,
} from './assetAdmission.ts'
import { issueError, withIssueCode } from './issue-codes.ts'
import { assembleOutputShardfile } from './outputIndex.ts'
import { offlineMemoryAdmission } from './shardfile-assets.ts'
import {
  assertShardfileTargets,
  checkWorldTargets,
} from './shardfileValidation.ts'
import { parseShardfile } from './shardSchema.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { AssetAdmission } from './assetAdmission.ts'
import type { OutputIndex } from './outputIndex.ts'
import type { ScriptAdmissionRows } from './scriptContract.ts'
import type { AssetPasses } from './shardfile-stream-assets.ts'
import type { Shardfile } from './shardSchema.ts'

/** `admitShardfileFolder`'s steps before `validateShardfileAssets`: the schema, declared costs and targets. */
function admitHead(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  payloads: ReadonlyMap<string, unknown>,
): Shardfile {
  const shard = withIssueCode('shard-schema', (): Shardfile =>
    parseShardfile(assembleOutputShardfile(index, payloads)),
  )
  withIssueCode('declared-costs', (): void => {
    preflightDeclaredCosts(shard, offlineMemoryAdmission('warn'))
  })
  withIssueCode('performance-targets', (): void => {
    assertShardfileTargets(shard, 'warn')
  })
  return shard
}

/** The shard's head and its asset admission's first steps, or the refusal they gave: thrown only after the packs, the
 *  cook and the inventory, as `validateShardfileFolder` orders them. */
function admitBeforeAssets(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  payloads: ReadonlyMap<string, unknown>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's row type, only read
  scripts: ScriptAdmissionRows,
): Readonly<{ admission: AssetAdmission | undefined; refusal: unknown }> {
  try {
    const head = admitHead(index, payloads)
    return {
      admission: withIssueCode('asset-admission', (): AssetAdmission =>
        assetAdmission(head, offlineMemoryAdmission('warn'), scripts),
      ),
      refusal: undefined,
    }
  } catch (error) {
    return { admission: undefined, refusal: error }
  }
}

/** `validateShardfileAssets` from the commons on, over what the later reads found. */
function admitAssets(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the admission state, which the commons update
  before: Readonly<{ admission: AssetAdmission | undefined; refusal: unknown }>,
  later: Readonly<AssetPasses>,
  hash: (bytes: Readonly<Uint8Array>) => string,
): Shardfile {
  const { admission } = before
  if (admission === undefined) {
    throw before.refusal
  }
  return withIssueCode('asset-admission', (): Shardfile => {
    admitCommonsBytes(admission, later.assets, hash)
    const refused = later.fileErrors.find(
      (error: string | undefined): boolean => error !== undefined,
    )
    if (refused !== undefined) {
      throw new Error(refused)
    }
    return admitAfterFiles(
      admission,
      later.assets,
      offlineMemoryAdmission('warn'),
    )
  })
}

/** `validateShardfileFolder`'s steps after the assets: the world targets and the source hash. */
function admitTail(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  shard: Shardfile,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  product: Readonly<{
    index: OutputIndex
    payloads: ReadonlyMap<string, unknown>
    hash: (bytes: Readonly<Uint8Array>) => string
  }>,
): void {
  checkWorldTargets(shard, product.payloads.get('world/targets'))
  if (
    product.hash(validationSourceBytes(shard)) !==
    product.index.build.sourceHash
  ) {
    throw issueError(
      'source-hash',
      'Output sections differ from the declared source hash',
    )
  }
}

export { admitAssets, admitBeforeAssets, admitHead, admitTail }
