/** FORMAT-PRUNE FP16 (meta; carries ONE-FORMAT OF17b3): `quests/server`, the home of the quest family's server hosts
 * (`quest.chapter`, `quest.kill-steps`, `quest.body-scripts`, `quest.composition`). Its rows are the native plan's own
 * quest rows, in install order; the engine stands them where a plan names no quest host, so `server/native-assembly.json`
 * no longer lists them. The rows name files and flags only; the server-class files they read stay server class. */
import { array, literal, maxLength, minLength, pipe, strictObject } from 'valibot'

import type { GenericSchema } from 'valibot'

import { NativeQuestHostSchema, type NativeQuestHostRow } from './nativeAssembly.ts'

/** The section's only version. */
const VERSION = 1
/** One row per quest host, at most. */
const MAX_HOSTS = 4

/** The section's value: the quest hosts in the order they install. */
interface QuestServer {
  readonly version: typeof VERSION
  readonly hosts: readonly NativeQuestHostRow[]
}

// A host named twice is refused where the engine stands the family (a `check` would not project to JSON Schema, FP9).
const HostsSchema = pipe(array(NativeQuestHostSchema), minLength(1), maxLength(MAX_HOSTS))

const QuestServerSchema: GenericSchema<unknown, QuestServer> = strictObject({
  version: literal(VERSION),
  hosts: HostsSchema,
})

export { type QuestServer, QuestServerSchema }
