/* oxlint-disable typescript/prefer-readonly-parameter-types, no-magic-numbers -- a session collects its problems as it runs, and its fixtures name their own numbers */
import {
  ANIMAL,
  EXACT,
  FRAMES,
  KITE,
  LOST_ACK,
  PLAYER,
  RIDE,
  roomClasses,
  snapshot,
} from './cross-frames.ts'

import type { ClassColumns } from '../../src/columns.ts'
import type { ClassProjection } from '../../src/projection.ts'
import type { RawFrame, SnapshotTable } from '../../src/snapshot.ts'
import type { Ends } from './cross-frames.ts'

// WR6 (7): the client's half of the frame session: decode each frame
// against its held baselines, project it, and say what came out wrong.

/** What the client learned from the room's welcome tables. */
interface Learned {
  readonly room: ReadonlyMap<number, ClassColumns>
  readonly sender: ReadonlyMap<number, ClassColumns>
  readonly projected: ReadonlyMap<number, ClassProjection>
}

function learn(ends: Ends): Learned {
  const classes = roomClasses(ends.room),
    { client, room } = ends
  const tables = client.classTables.decodeClassTables(
    room.classTables.encodeClassTables(classes),
  )
  return {
    room: new Map(
      classes.map((entry): readonly [number, ClassColumns] => [
        entry.id,
        room.columns.classColumns(entry),
      ]),
    ),
    sender: new Map(
      tables.map((entry): readonly [number, ClassColumns] => [
        entry.id,
        client.columns.classColumns(entry),
      ]),
    ),
    projected: client.projection.projectClasses(
      tables,
      client.classes.WIRE_CLASSES,
    ),
  }
}

/** The decode table over the client's held baselines. */
function tableOf(
  learned: Learned,
  held: ReadonlyMap<number, RawFrame>,
): SnapshotTable {
  const owner = learned.sender.get(PLAYER)
  if (owner === undefined) {
    throw new Error('the room sent no player class')
  }
  return {
    ownerClass: owner,
    classOf: (handle: number): ClassColumns | undefined =>
      learned.sender.get(handle === 1 ? ANIMAL : KITE),
    rideLaw: (id: number): typeof RIDE | undefined =>
      id === RIDE.id ? RIDE : undefined,
    baseline: (tick: number): RawFrame | undefined => held.get(tick),
  }
}

/** What a client that held projections instead of raw rows would keep (the WR4 revert). */
function asProjectedBaseline(
  ends: Ends,
  learned: Learned,
  raw: RawFrame,
): RawFrame {
  const slots = learned.projected.get(ANIMAL)?.row ?? []
  const rows = new Map(
    [...raw.rows].map(
      ([handle, row]): readonly [number, Readonly<Uint32Array>] => [
        handle,
        handle === 1
          ? Uint32Array.from(ends.client.projection.projectRow(slots, row))
          : row,
      ],
    ),
  )
  return { ...raw, rows }
}

/** Each wrong thing in one projected frame: the animal row, the kite left out, px..vz, the ride. */
function check(ends: Ends, learned: Learned, raw: RawFrame): readonly string[] {
  const { projectRow } = ends.client.projection
  const { tick } = raw
  const [animal, player] = [
    learned.projected.get(ANIMAL),
    learned.projected.get(PLAYER),
  ]
  // Each local animal column by id: the room's word where the room sends it
  // ((tick + its sender index) % 2, `mood` sitting first), else the local
  // default, 0, for a field the room lacks (an older room, CC28's channels).
  const sent = learned.room.get(ANIMAL)?.row ?? []
  const want = (animal?.local.row ?? []).map(
    (column: { readonly id: number }): number => {
      const at = sent.findIndex(
        (theirs: { readonly id: number }): boolean => theirs.id === column.id,
      )
      return at < 0 ? 0 : (tick + at) % 2
    },
  )
  const got = [...projectRow(animal?.row ?? [], raw.rows.get(1) ?? [])]
  const owner = projectRow(player?.owner ?? [], raw.owner)
  const local = player?.local.owner ?? []
  const exact = [...EXACT].filter(
    ([id, value]: readonly [number, number]): boolean =>
      owner[
        local.findIndex(
          (column: { readonly id: number }): boolean => column.id === id,
        )
      ] !== value,
  )
  return [
    ...(JSON.stringify(got) === JSON.stringify(want)
      ? []
      : [
          `frame ${String(tick)}: animal row ${JSON.stringify(got)}, not ${JSON.stringify(want)}`,
        ]),
    ...(raw.rows.has(2) && learned.projected.get(KITE) === undefined
      ? []
      : [`frame ${String(tick)}: the kite was not decoded and left out`]),
    ...exact.map(
      ([id]: readonly [number, number]): string =>
        `frame ${String(tick)}: owner field ${String(id)} lost bits`,
    ),
    ...(tick % 5 === 0 && raw.ride?.words.length !== RIDE.words
      ? [`frame ${String(tick)}: ride words lost`]
      : []),
  ]
}

/** One session's state: its ends, what the client learned, and its held raw frames. */
interface Run {
  readonly ends: Ends
  readonly learned: Learned
  readonly held: Map<number, RawFrame>
}

/** One frame, room to client, against the client's last ack; what came out wrong. */
function oneFrame(
  run: Run,
  sent: { readonly tick: number; readonly acked: number | undefined },
): readonly string[] {
  const { ends, learned, held } = run
  const bytes = ends.room.frameRecord.encodeFrame(snapshot(learned.room, sent))
  const raw = ends.client.frameRecord.decodeFrameMessage(
    bytes,
    tableOf(learned, held),
  )
  if (raw === undefined) {
    return [`frame ${String(sent.tick)} could not apply`]
  }
  held.set(
    sent.tick,
    ends.projectedBaseline ? asProjectedBaseline(ends, learned, raw) : raw,
  )
  return check(ends, learned, raw)
}

/** Thirty frames, room to client; every problem the client saw. */
function frameProblems(ends: Ends): readonly string[] {
  const run: Run = {
    ends,
    learned: learn(ends),
    held: new Map<number, RawFrame>(),
  }
  const problems: string[] = []
  let acked: number | undefined = undefined
  for (let tick = 1; tick <= FRAMES; tick += 1) {
    problems.push(...oneFrame(run, { tick, acked }))
    acked = tick === LOST_ACK ? acked : tick
  }
  return problems
}

export { frameProblems }
