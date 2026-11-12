// The declared half of `admitShardfileProduct` for the streaming validator
// (API-CLOUDFLARE AC6a): the schema, declared costs and targets, the world
// targets and the source hash, none of which reads an asset's bytes.

import { preflightDeclaredCosts } from './assetAdmission.ts'
import { assembleOutputShardfile } from './outputIndex.ts'
import { offlineMemoryAdmission } from './product.ts'
import { assertProductTargets, checkWorldTargets } from './productValidation.ts'
import { parseShardfile } from './shardSchema.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { OutputIndex } from './outputIndex.ts'
import type { Shardfile } from './shardSchema.ts'

/** `validateShardfileProduct`'s last steps without `validateShardfileAssets`, which stays pending. */
function admitDeclared(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  payloads: ReadonlyMap<string, unknown>,
  hash: (bytes: Readonly<Uint8Array>) => string,
): Shardfile {
  const shard = parseShardfile(assembleOutputShardfile(index, payloads))
  preflightDeclaredCosts(shard, offlineMemoryAdmission('warn'))
  assertProductTargets(shard, 'warn')
  checkWorldTargets(shard, payloads.get('world/targets'))
  if (hash(validationSourceBytes(shard)) !== index.build.sourceHash) {
    throw new Error('Output sections differ from the declared source hash')
  }
  return shard
}

export { admitDeclared }
