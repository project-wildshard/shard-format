import { classColumns } from './columns.ts'
import { WireDecodeError } from './wire-error.ts'
import { wordCodec } from './words.ts'

import type { ClassColumns, Column } from './columns.ts'
import type { WireArm, WireClass, WireClassField } from './grammar.ts'
import type { WordCodec } from './words.ts'

// WIRE-STABILITY 5.4: projection is separate from decoding. At welcome the
// receiver maps each sender class to its own class by id, and each sender
// column to its own slot by field id; game code reads only the projection.
// A local field the sender lacks reads its default. A local required field
// (a position the interpolator reads, a field the predictor resolves) that
// the sender's table lacks refuses at the handshake, before play.

/** One local column: where its value comes from in the sender's layout. */
interface Slot {
  /** The sender column index, or -1 for a field the sender lacks. */
  readonly from: number
  /** The sender word as the local word; identity when the nodes match. */
  readonly convert: (word: number) => number
  /** The local word for a field the sender lacks. */
  readonly fallback: number
}
/** One sender class projected onto a local one. */
interface ClassProjection {
  readonly local: ClassColumns
  readonly row: readonly Slot[]
  readonly owner: readonly Slot[]
  readonly initial: readonly Slot[]
}

const MISSING = -1
const RIDE_WORD_BITS = 32
const same = (word: number): number => word

function slotFor(local: Column, sender: readonly Column[]): Slot {
  const from = sender.findIndex(
    (column: Column): boolean => column.id === local.id,
  )
  const mine: WordCodec = wordCodec(local.node)
  const theirs = sender[from]
  if (theirs === undefined) {
    return { from: MISSING, convert: same, fallback: mine.fallback }
  }
  const match = JSON.stringify(theirs.node) === JSON.stringify(local.node)
  const peer = wordCodec(theirs.node)
  return {
    from,
    convert: match
      ? same
      : (word: number): number => mine.toWord(peer.toValue(word)),
    fallback: mine.fallback,
  }
}

const slots = (
  local: readonly Column[],
  sender: readonly Column[],
): readonly Slot[] =>
  local.map((column: Column): Slot => slotFor(column, sender))

/** Refuse a sender table that lacks a field this receiver requires. */
function checkRequired(local: WireClass, sender: WireClass): void {
  for (const field of local.fields) {
    const needed = field.required === true || field.predicted === true
    const has = sender.fields.some(
      (entry: WireClassField): boolean =>
        entry.id === field.id && entry.node.kind === field.node.kind,
    )
    if (needed && !has) {
      throw new WireDecodeError(
        `The server's ${local.name} lacks required ${field.name}`,
      )
    }
  }
}

/** Every sender class this receiver knows, projected by id. */
function projectClasses(
  sender: readonly WireClass[],
  local: readonly WireClass[],
): ReadonlyMap<number, ClassProjection> {
  const out = new Map<number, ClassProjection>()
  for (const theirs of sender) {
    const mine = local.find(
      (entry: WireClass): boolean => entry.id === theirs.id,
    )
    if (mine !== undefined) {
      checkRequired(mine, theirs)
      const localColumns = classColumns(mine)
      const senderColumns = classColumns(theirs)
      out.set(theirs.id, {
        local: localColumns,
        row: slots(localColumns.row, senderColumns.row),
        owner: slots(localColumns.owner, senderColumns.owner),
        initial: slots(localColumns.initial, senderColumns.initial),
      })
    }
  }
  return out
}

/** A sender row (or owner block) in the receiver's layout. */
function projectRow(
  slotsOf: readonly Slot[],
  raw: ArrayLike<number>,
): Float64Array {
  const out = new Float64Array(slotsOf.length)
  for (const [index, slot] of slotsOf.entries()) {
    const word = raw[slot.from]
    out[index] = word === undefined ? slot.fallback : slot.convert(word)
  }
  return out
}

/** Ride words are f32 values: a word the sender lacks is not a word to guess. */
const rideColumns = (law: WireArm): readonly Column[] =>
  law.fields.map((field: WireArm['fields'][number]): Column => ({
    id: field.id,
    bits: RIDE_WORD_BITS,
    node: field.node,
  }))

/** A ride law projected: its word slots, and whether it seats the rider. */
interface RideProjection {
  readonly seated: boolean
  readonly words: readonly Slot[]
}

/**
 * Each sender ride law this receiver knows: its word slots, and whether the
 * sender's law holds every one of the receiver's words. A client is never
 * seated on a mount whose law it can't read whole; the block stays raw.
 */
function projectRides(
  sender: readonly WireArm[],
  local: readonly WireArm[],
): ReadonlyMap<number, RideProjection> {
  const out = new Map<number, RideProjection>()
  for (const theirs of sender) {
    const mine = local.find((law: WireArm): boolean => law.id === theirs.id)
    if (mine !== undefined) {
      const words = slots(rideColumns(mine), rideColumns(theirs))
      const seated = words.every((slot: Slot): boolean => slot.from !== MISSING)
      out.set(theirs.id, { seated, words })
    }
  }
  return out
}

export {
  projectClasses,
  projectRides,
  projectRow,
  type ClassProjection,
  type RideProjection,
  type Slot,
}
