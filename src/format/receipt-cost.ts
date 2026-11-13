// oxlint-disable typescript/prefer-readonly-parameter-types -- a Shardfile has no deep-readonly form the cost walks take; nothing here writes it
import { preflightDeclaredCosts } from './assetAdmission.ts'
import { structuralGridEvidence } from './gridReadiness.ts'
import { postStackCost } from './postStack.ts'
import { offlineMemoryAdmission } from './product.ts'
import {
  productWireBytes,
  publishedSourceResidency,
} from './sourceResidency.ts'

import type { worstContentCost } from './budget.ts'
import type { GridStructuralEvidence } from './gridReadiness.ts'
import type { PostStackCost } from './postStack.ts'
import type { Shardfile } from './shardSchema.ts'

// The figures a build receipt (`validation.json`) carries about an admitted
// product: what it costs to hold and to draw. `shardfile pack` stamps them
// again here when it re-seals a product, so an edited section can't leave a
// stale figure behind (Brasscap rev 3 kept 2,930,740 bytes over 4,670,827
// bytes of wire). sharddev's writer calls the same four functions
// (outputProduct.ts); a repacked unchanged product gets its receipt back
// byte for byte. Moving sharddev onto `receiptCost` makes it one call.

/** A receipt's figures, each measured from the admitted product. */
interface ReceiptCost {
  readonly gridReady: GridStructuralEvidence
  readonly postCost: PostStackCost
  readonly residentBytes: number
  readonly worst: ReturnType<typeof worstContentCost>
}

/** Every figure a receipt carries about `shard`, whose bytes `assets` holds by hash. */
function receiptCost(
  shard: Shardfile,
  assets: ReadonlyMap<string, Readonly<Uint8Array>>,
): ReceiptCost {
  const read = (hash: string): Uint8Array | undefined => assets.get(hash)
  return {
    gridReady: structuralGridEvidence(shard),
    postCost: postStackCost(shard, read).cost,
    residentBytes: publishedSourceResidency(shard),
    worst: preflightDeclaredCosts(shard, offlineMemoryAdmission('warn')).worst,
  }
}

function stampedResidency(receipt: unknown): number | undefined {
  if (typeof receipt !== 'object' || receipt === null) {
    return undefined
  }
  const stamped: unknown = Reflect.get(receipt, 'residentBytes')
  return typeof stamped === 'number' ? stamped : undefined
}

/** Why a receipt's memory figure can't be true for `shard`: it is below the
 *  bytes of its own files, which a host holds before it parses any. A receipt
 *  with no figure has nothing to check. */
function receiptResidencyShortfall(
  receipt: unknown,
  shard: Shardfile,
): string | undefined {
  const stamped = stampedResidency(receipt)
  const wire = productWireBytes(shard)
  if (stamped === undefined || stamped >= wire) {
    return undefined
  }
  const measured = publishedSourceResidency(shard)
  return `validation.json residentBytes ${String(stamped)} is below the product's ${String(wire)} bytes of files (it measures ${String(measured)}); pack it again to restamp the receipt`
}

export type { ReceiptCost }
export { receiptCost, receiptResidencyShortfall }
