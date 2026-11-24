/** FORMAT-PRUNE FP16d (meta): a primitive family's server hosts, each family in its own section (`server/riding`,
 * `server/boss`, `server/patrol`), so `server/native-assembly.json` lists none. Each row is the native plan's own row for
 * that host, in install order. Here a row is held to the shape that projects to JSON Schema (FP9): it names its `host`;
 * the engine admits each row with the plan's own row schema where it stands the family, as `server/plan` does (HS6b).
 * The quest family's section (`server/quest`) is typed in full (`quest-server.ts`). */
import {
  array,
  literal,
  looseObject,
  maxLength,
  minLength,
  pipe,
  strictObject,
  string,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** The section's only version. */
const VERSION = 1
/** A family stands at least one host. */
const MIN_HOSTS = 1
/** The most hosts one family stands. */
const MAX_HOSTS = 16

/** One host's row as the section holds it: its host and its settings. */
interface ServerHostRow {
  readonly host: string
  readonly [key: string]: unknown
}

/** The section's value: the family's hosts in the order they install. */
interface ServerHosts {
  readonly version: typeof VERSION
  readonly hosts: readonly ServerHostRow[]
}

const RowSchema = looseObject({ host: string() })
const RowsSchema = pipe(
  array(RowSchema),
  minLength(MIN_HOSTS),
  maxLength(MAX_HOSTS),
)

const ServerHostsSchema: GenericSchema<unknown, ServerHosts> = strictObject({
  version: literal(VERSION),
  hosts: RowsSchema,
})

export { type ServerHostRow, type ServerHosts, ServerHostsSchema }
