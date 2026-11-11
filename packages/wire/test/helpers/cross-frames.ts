/* oxlint-disable typescript/prefer-readonly-parameter-types, no-magic-numbers -- a session collects its problems as it runs, and its fixtures name their own numbers */
import type { ClassColumns } from '../../src/columns.ts'
import type { WireClass, WireClassField } from '../../src/grammar.ts'
import type { RowSource, SnapshotInput } from '../../src/snapshot.ts'
import type { Codec } from './cross-codec.ts'

// WR6 (7): thirty frames from a room on one codec to a client on another,
// with skew the client must project past: the room's animal has a field the
// client lacks, first, so every sender column sits a slot later, and a class
// (kite) the client lacks. The client keeps RAW frames as its baselines
// (WR4); `projectedBaseline` keeps the projection instead, which is the
// revert the harness must catch. One ack is lost and one frame goes whole.

const ANIMAL = 2
const KITE = 9
const PLAYER = 1
const MOOD: WireClassField = {
  id: 99,
  name: 'mood',
  node: { kind: 'uint', bits: 3 },
  send: 'all',
}
const KITE_CLASS: WireClass = {
  id: KITE,
  name: 'kite',
  fields: [{ id: 1, name: 'x', node: { kind: 'uint', bits: 8 } }],
}
const FRAMES = 30
const LOST_ACK = 10
const WHOLE = 20
const RIDE = { id: 1, words: 38 }
/** Exact doubles no float32 holds, for px, py, pz, vx, vy and vz (J140). */
const EXACT = new Map([
  [11, 123.45678901234567],
  [12, -0.000123456789],
  [13, 9876.54321098765],
  [14, 1.1],
  [15, -2.2e-7],
  [16, 3.3333333333333335],
])

/** The room's classes: its own, the animal with `mood` first, and a kite. */
function roomClasses(room: Codec): readonly WireClass[] {
  const own = room.classes.WIRE_CLASSES.map((entry: WireClass): WireClass =>
    entry.id === ANIMAL ? { ...entry, fields: [MOOD, ...entry.fields] } : entry,
  )
  return [...own, KITE_CLASS]
}

/** A frame's rows: the animal (handle 1) and the kite (handle 2), in the room's layout. */
function rowSource(tick: number, animal: number): RowSource {
  const data = [
    ...Array.from({ length: animal }, (_unused: unknown, at: number): number =>
      at === 0 ? tick % 8 : (tick + at) % 2,
    ),
    tick % 256,
  ]
  return {
    tick,
    data,
    offset: (handle: number): number | undefined => [0, animal].at(handle - 1),
  }
}

/** The owner block in the room's layout: the exact doubles where they sit, small words elsewhere. */
function ownerBlock(columns: ClassColumns): Float64Array {
  return Float64Array.from(
    columns.owner.map(
      (column: { readonly id: number }, at: number): number =>
        EXACT.get(column.id) ?? at % 2,
    ),
  )
}

/** What both ends hold for a session. */
interface Ends {
  readonly room: Codec
  readonly client: Codec
  readonly projectedBaseline: boolean
}

/** The room's frame for `tick`, against what the client last acked. */
function snapshot(
  columns: ReadonlyMap<number, ClassColumns>,
  sent: { readonly tick: number; readonly acked: number | undefined },
): SnapshotInput {
  const animal = columns.get(ANIMAL)?.row.length ?? 0,
    player = columns.get(PLAYER)
  if (player === undefined) {
    throw new Error('no player class')
  }
  const base =
    sent.acked === undefined || sent.tick === WHOLE
      ? undefined
      : { frame: rowSource(sent.acked, animal), visible: new Set([1, 2]) }
  return {
    frame: rowSource(sent.tick, animal),
    cell: 0,
    lastSeq: sent.tick,
    ownerClass: player,
    owner: ownerBlock(player),
    ride:
      sent.tick % 5 === 0
        ? {
            law: RIDE.id,
            words: Float64Array.from(
              { length: RIDE.words },
              (_unused: unknown, at: number): number => at / 4,
            ),
          }
        : undefined,
    visible: new Set([1, 2]),
    baseline: base,
    classOf: (handle: number): ClassColumns | undefined =>
      columns.get(handle === 1 ? ANIMAL : KITE),
  }
}

export {
  ANIMAL,
  EXACT,
  FRAMES,
  KITE,
  LOST_ACK,
  PLAYER,
  RIDE,
  roomClasses,
  rowSource,
  snapshot,
  type Ends,
}
