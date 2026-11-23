/** SHARD-COMPAT HS6b (meta): `server/plan`, the server's own copy of the feature rows, so `client/plan` stays the page's.
 * The SDK writes it from the parsed `client/plan` (HS6d) and the engine's server parses each row with the client plan's
 * own schema at its seam (HS6c); here it is held to the shape that projects to JSON Schema (FP9): a version and up to 64
 * rows, each naming its kind. */
import {
  array,
  literal,
  looseObject,
  maxLength,
  pipe,
  strictObject,
  string,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** The section's only version. */
const VERSION = 1
/** The most feature rows a plan holds, as `client/plan`'s schema caps them. */
const MAX_FEATURES = 64

/** One feature row as the section holds it: its kind and its settings. */
interface ServerPlanRow {
  readonly kind: string
  readonly [key: string]: unknown
}

/** The section's value. */
interface ServerPlan {
  readonly version: typeof VERSION
  readonly features: readonly ServerPlanRow[]
}

const RowSchema = looseObject({ kind: string() })
const RowsSchema = pipe(array(RowSchema), maxLength(MAX_FEATURES))

const ServerPlanSchema: GenericSchema<unknown, ServerPlan> = strictObject({
  version: literal(VERSION),
  features: RowsSchema,
})

export { type ServerPlan, type ServerPlanRow, ServerPlanSchema }
