/** FORMAT-PRUNE FP60: an incoming original, mended of each deleted field before its strict parse. A published client
 * still sends what its own format required: `@wildshard/upload` 0.4.22 (the oldest supported) checks with format 0.63.0
 * and 0.4.25 with 0.66.0, both needing `requires.sdk`, and format 0.79.1's strict index refused every such upload
 * ("Invalid key: Expected never but received sdk"). The stored bytes keep the field; the chain mends each copy it
 * writes (`format-migration-deleted.ts`). Both validators read an original's index and sections through here, and check
 * its declared source hash here: the client hashed `requires` as it sent it, `sdk` included. */
import { mendDeletedFields } from './format-migration-deleted.ts'
import { rememberSentSdk, sentForms } from './incoming-sent.ts'
import { parseOutputIndex, validateOutputSection } from './outputIndex.ts'
import { writtenSourceBytes } from './save-revision.ts'

import type { OutputIndex } from './outputIndex.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `shard.json` as uploaded: its deleted fields mended in place (`requires.sdk`), then parsed strictly. */
function parseIncomingIndex(index: unknown): OutputIndex {
  const requires = isRecord(index) ? index['requires'] : undefined
  const sdk = isRecord(requires) ? requires['sdk'] : undefined
  if (isRecord(index)) {
    mendDeletedFields({ index, sections: new Map(), mounts: new Map() })
  }
  const parsed = parseOutputIndex(index)
  if (sdk !== undefined) {
    rememberSentSdk(parsed, sdk)
  }
  return parsed
}

/** A section as uploaded: its deleted fields mended in place (the old grid pointer becomes `shardfile`), then
 * validated strictly. */
function validateIncomingSection(name: string, value: unknown): void {
  const sections = new Map([[name, value]])
  mendDeletedFields({ index: {}, sections, mounts: new Map() })
  validateOutputSection(name, value)
}

/** Whether `index`'s declared source hash covers `shard` as admitted, or as its client hashed it: with the
 * `requires.sdk` it sent (`parseIncomingIndex`). */
function declaredSourceMatches(
  shard: Readonly<{ requires?: object }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  hash: (bytes: Readonly<Uint8Array>) => string,
): boolean {
  return sentForms(shard, index).some(
    (source: object): boolean =>
      hash(writtenSourceBytes(source, index.formatVersion)) ===
      index.build.sourceHash,
  )
}

export { declaredSourceMatches, parseIncomingIndex, validateIncomingSection }
