import { maxLength, pipe, regex, string } from 'valibot'
import type { GenericSchema } from 'valibot'

// SemVer without build metadata, reserved for the catalogue's migrated copies.
const number = String.raw`(?:0|[1-9]\d*)`
const identifier = String.raw`(?:${number}|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)`
const shardVersion = new RegExp(
  String.raw`^${number}\.${number}\.${number}(?:-${identifier}(?:\.${identifier})*)?$`,
  'u',
)
const MAX_VERSION_LENGTH = 128

export const ShardVersionSchema: GenericSchema<string> = pipe(
  string(),
  maxLength(MAX_VERSION_LENGTH),
  regex(shardVersion, 'Expected a shardVersion without build metadata'),
)
