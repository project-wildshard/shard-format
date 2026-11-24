/** FORMAT-PRUNE FP21 (meta): `server/world`, the native world's own settings that are not a host: its level, terrain,
 * navigation, population bake, collision, entry walks, riding boot rows and field. With the family sections
 * (`server-hosts.ts`, `quest-server.ts`) it replaces `server/native-assembly.json`: a world that holds it ships no plan
 * file. Here the value is held to the shape that projects to JSON Schema (FP9); the engine admits it with the plan's own
 * field schemas where it builds the world. The server-class files these settings name stay server class (FP21 default,
 * coordinator 2026-11-24). */
import {
  exactOptional,
  literal,
  looseObject,
  string,
  strictObject,
  union,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** The section's only version. */
const VERSION = 1

/** One group of settings: an object the engine admits field by field. */
type Settings = Readonly<Record<string, unknown>>

/** The section's value. */
interface ServerWorld {
  readonly version: typeof VERSION
  readonly level: Settings
  readonly terrain: Settings & { readonly kind: string }
  readonly navigation: 'shard' | (Settings & { readonly file: string })
  readonly bake?: Settings
  readonly collision?: Settings
  readonly entries: Settings
  readonly boot?: Settings
  readonly field?: Settings
}

const SettingsSchema = looseObject({})
const TerrainSchema = looseObject({ kind: string() })
const NavigationSchema = union([
  literal('shard'),
  looseObject({ file: string() }),
])

const ServerWorldSchema: GenericSchema<unknown, ServerWorld> = strictObject({
  version: literal(VERSION),
  level: SettingsSchema,
  terrain: TerrainSchema,
  navigation: NavigationSchema,
  bake: exactOptional(SettingsSchema),
  collision: exactOptional(SettingsSchema),
  entries: SettingsSchema,
  boot: exactOptional(SettingsSchema),
  field: exactOptional(SettingsSchema),
})

export { type ServerWorld, ServerWorldSchema }
