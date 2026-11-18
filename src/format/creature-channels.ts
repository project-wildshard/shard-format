// ONE-FORMAT CC28: a body's actor channels and the looks bound to them.
// A creature has at most four channels, each a 0..1 value the server owns
// (a script's `actorChannel` command sets one) and the wire carries as
// animal fields 25 to 28 in the body's `channels` order. A page binds the
// look's material tint, emissive and opacity to channels, and may switch to
// a second look while a channel is at or above `at` (Q-CC48).
import {
  array,
  check,
  exactOptional,
  finite,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  regex,
  strictObject,
  string,
  tuple,
} from 'valibot'

import type { GenericSchema } from 'valibot'

const ONE = 1
const MAX_CHANNELS = 4
const MAX_ID = 128
const id = pipe(string(), regex(/^[a-z][a-zA-Z0-9.:-]*$/u), maxLength(MAX_ID))
const unit = pipe(number(), finite(), minValue(0), maxValue(ONE))
const colour = tuple([unit, unit, unit])

interface CreatureChannel {
  name: string
  /** The value a creature spawns with; 0 when omitted. */
  initial?: number
}
/** A material term that follows one channel: the look's colour moves toward `colour` as the channel goes 0 to 1. */
interface CreatureChannelColour {
  channel: string
  colour: [number, number, number]
}
interface CreatureChannelBind {
  tint?: CreatureChannelColour
  emissive?: CreatureChannelColour
  /** The material's opacity is this channel's value. */
  opacity?: string
}
/** While `channel` is at or above `at` (0.5 when omitted) the body draws `look` instead of its own. */
interface CreatureLookSwap {
  channel: string
  look: string
  at?: number
}

const channelRow = strictObject({ name: id, initial: exactOptional(unit) })
const CreatureChannelsSchema: GenericSchema<CreatureChannel[]> = pipe(
  array(channelRow),
  minLength(ONE),
  maxLength(MAX_CHANNELS),
  check<CreatureChannel[], 'Duplicate creature channel'>(
    (rows: readonly { readonly name: string }[]): boolean =>
      new Set(rows.map((row: { readonly name: string }): string => row.name))
        .size === rows.length,
    'Duplicate creature channel',
  ),
)
const channelColour = strictObject({ channel: id, colour })
const CreatureChannelBindSchema: GenericSchema<CreatureChannelBind> =
  strictObject({
    tint: exactOptional(channelColour),
    emissive: exactOptional(channelColour),
    opacity: exactOptional(id),
  })
const CreatureLookSwapSchema: GenericSchema<CreatureLookSwap> = strictObject({
  channel: id,
  look: id,
  at: exactOptional(unit),
})

/** Every channel name a body's `bind` and `swap` read. */
function boundChannels(body: {
  readonly bind?: Readonly<CreatureChannelBind>
  readonly swap?: Readonly<CreatureLookSwap>
}): readonly string[] {
  const { bind, swap } = body
  return [
    ...(bind?.tint === undefined ? [] : [bind.tint.channel]),
    ...(bind?.emissive === undefined ? [] : [bind.emissive.channel]),
    ...(bind?.opacity === undefined ? [] : [bind.opacity]),
    ...(swap === undefined ? [] : [swap.channel]),
  ]
}

/** A body binds only channels it declares. */
function channelsDeclared(body: {
  readonly channels?: readonly { readonly name: string }[]
  readonly bind?: Readonly<CreatureChannelBind>
  readonly swap?: Readonly<CreatureLookSwap>
}): boolean {
  const names = new Set(
    (body.channels ?? []).map(
      (row: { readonly name: string }): string => row.name,
    ),
  )
  return boundChannels(body).every((name: string): boolean => names.has(name))
}

export {
  CreatureChannelBindSchema,
  CreatureChannelsSchema,
  CreatureLookSwapSchema,
  channelsDeclared,
  MAX_CHANNELS,
}
export type {
  CreatureChannel,
  CreatureChannelBind,
  CreatureChannelColour,
  CreatureLookSwap,
}
