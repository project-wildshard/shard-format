/** The two `shard.json` envelopes' version fields (SHARD-COMPAT CP14, FORMAT-PRUNE FP25), shared by every index
 * reader: the full parser (`outputIndex.ts`), the lineage reader and the download reader. */
import { exactOptional, literal, picklist, union } from 'valibot'

import {
  INDEX_FORMAT_VERSIONS,
  LEGACY_INDEX_VERSIONS,
  LEGACY_LAYOUT,
} from './version.ts'

import type {
  ExactOptionalSchema,
  LiteralSchema,
  PicklistSchema,
  UnionSchema,
} from 'valibot'

/** `formatVersion`: the frozen layout marker `2` (formats 0.1 to 0.1.0.1), or the format version itself (0.1.0.2 on). */
const IndexFormatVersionSchema: UnionSchema<
  [
    LiteralSchema<typeof LEGACY_LAYOUT, undefined>,
    PicklistSchema<typeof INDEX_FORMAT_VERSIONS, undefined>,
  ],
  undefined
> = union([literal(LEGACY_LAYOUT), picklist(INDEX_FORMAT_VERSIONS)])

/** `version`: only the legacy envelope carries it, beside the layout marker. */
const LegacyIndexVersionSchema: ExactOptionalSchema<
  PicklistSchema<typeof LEGACY_INDEX_VERSIONS, undefined>,
  undefined
> = exactOptional(picklist(LEGACY_INDEX_VERSIONS))

export { IndexFormatVersionSchema, LegacyIndexVersionSchema }
