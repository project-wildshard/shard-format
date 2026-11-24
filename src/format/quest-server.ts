/** FORMAT-PRUNE FP16 (meta; carries ONE-FORMAT OF17b3): `server/quest`, the home of the quest family's server hosts
 * (`quest.chapter`, `quest.kill-steps`, `quest.body-scripts`, `quest.composition`). Its rows are the native plan's own
 * quest rows, in install order (`nativeAssembly.ts` admits the same rows); the engine stands them where a plan names no
 * quest host, so `server/native-assembly.json` no longer lists them. The rows name files and flags only; the
 * server-class files they read stay server class. */
import {
  array,
  boolean,
  exactOptional,
  literal,
  maxLength,
  minLength,
  pipe,
  strictObject,
  string,
  union,
  unknown,
  variant,
} from 'valibot'

import type {
  NativeAssemblyFeature,
  NativeAssemblyRead,
} from './nativeAssembly.ts'
import type { GenericSchema } from 'valibot'

/** The section's only version. */
const VERSION = 1
/** One row per quest host, at most. */
const MAX_HOSTS = 4
/** The longest name a row holds, as the native plan bounds it. */
const MAX_KEY = 240
/** The deepest `path` a read walks, as the native plan bounds it. */
const MAX_PATH = 16
/** A name is never empty. */
const MIN_KEY = 1
/** A section holds at least one quest host. */
const MIN_HOSTS = 1

/** One quest host's row, as a plan or the section holds it. */
type NativeQuestHostRow = Extract<
  NativeAssemblyFeature,
  {
    host:
      | 'quest.composition'
      | 'quest.chapter'
      | 'quest.kill-steps'
      | 'quest.body-scripts'
  }
>

/** The section's value: the quest hosts in the order they install. */
interface QuestServer {
  readonly version: typeof VERSION
  readonly hosts: readonly NativeQuestHostRow[]
}

const key = pipe(string(), minLength(MIN_KEY), maxLength(MAX_KEY))
const path = pipe(array(key), maxLength(MAX_PATH))
const read: GenericSchema<unknown, NativeAssemblyRead> = union([
  strictObject({ file: key, path: exactOptional(path) }),
  strictObject({ section: key, path: exactOptional(path) }),
  strictObject({ value: unknown() }),
])
const flag = exactOptional(boolean())

/** The four quest host rows. */
const QUEST_HOST_ROWS = [
  strictObject({
    host: literal('quest.composition'),
    rows: read,
    spots: read,
    counters: read,
    document: exactOptional(read),
    table: exactOptional(read),
    contracts: exactOptional(read),
    props: exactOptional(read),
    readSpots: flag,
    nativeFeats: flag,
    barter: flag,
    director: flag,
    restoring: flag,
  }),
  // ONE-FORMAT OF22c3: a chapter's wake names a declared boss fight; `population` named the retired mixed population
  // and stays optional only for writers that still send it
  strictObject({
    host: literal('quest.chapter'),
    id: key,
    rows: read,
    wake: read,
    reward: unknown(),
    population: exactOptional(key),
  }),
  strictObject({
    host: literal('quest.kill-steps'),
    rows: read,
    counters: read,
  }),
  strictObject({ host: literal('quest.body-scripts') }),
] as const

const NativeQuestHostSchema: GenericSchema<unknown, NativeQuestHostRow> =
  variant('host', QUEST_HOST_ROWS)

// A host named twice is refused where the engine stands the family (a `check` would not project to JSON Schema, FP9).
const QuestServerSchema: GenericSchema<unknown, QuestServer> = strictObject({
  version: literal(VERSION),
  hosts: pipe(
    array(NativeQuestHostSchema),
    minLength(MIN_HOSTS),
    maxLength(MAX_HOSTS),
  ),
})

export {
  type NativeQuestHostRow,
  type QuestServer,
  NativeQuestHostSchema,
  QuestServerSchema,
}
