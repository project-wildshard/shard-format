/* oxlint-disable typescript/prefer-readonly-parameter-types -- frozen v0's FrameInput, DecodedFrame and captured frames are mutable types */
import { inputOf, receiverBase } from '../../bench/capture/prepared-frame.ts'
import { WIRE_CLASSES } from '../../src/classes.ts'
import { classColumns } from '../../src/columns.ts'
import { decodeFrame, encodeFrame } from '../../src/frame-record.ts'
import { readRecords } from '../../src/framing.ts'
import { MOUNT } from '../../src/rides.ts'

import type { CapturedFrame } from '../../bench/capture/frame-data.ts'
import type { DecodedFrame, FrameInput } from '../../frozen/v0/frame.ts'
import type { NetClass } from '../../frozen/v0/schema.ts'
import type { ClassColumns } from '../../src/columns.ts'
import type {
  RawFrame,
  RideLaw,
  RowSource,
  SnapshotInput,
} from '../../src/snapshot.ts'

// Bridge WS3's real captured frames (frozen v0 inputs) into v1 snapshot
// inputs, so the v1 codec replays real play: the same rows, owner blocks,
// rides, baselines, `rowFrom` sources and `due` decisions.

const NONE = 0
const MOUNT_LAW: RideLaw = { id: MOUNT.id, words: MOUNT.fields.length }

/** The v1 columns of every class, by name, compiled once. */
const COLUMNS: ReadonlyMap<string, ClassColumns> = new Map(
  WIRE_CLASSES.map(
    (entry: (typeof WIRE_CLASSES)[number]): readonly [string, ClassColumns] => [
      entry.name,
      classColumns(entry),
    ],
  ),
)

/** The v1 columns of a class, by its v0 class's name. */
function columnsOf(cls: Readonly<NetClass<never>>): ClassColumns {
  const columns = COLUMNS.get(cls.cls)
  if (columns === undefined) {
    throw new Error(`No v1 class ${cls.cls}`)
  }
  return columns
}

function baselineOf(input: Readonly<FrameInput>): SnapshotInput['baseline'] {
  const { baseline } = input
  if (baseline === null) {
    return undefined
  }
  const { rowFrom } = baseline
  return {
    frame: baseline.frame,
    visible: baseline.visible,
    ...(rowFrom === undefined
      ? {}
      : {
          rowFrom: (handle: number): RowSource | undefined =>
            rowFrom(handle) ?? undefined,
        }),
  }
}

/** A v0 frame input as a v1 snapshot input. */
function snapshotInput(input: Readonly<FrameInput>): SnapshotInput {
  const words = input.rideWords ?? NONE
  return {
    frame: input.frame,
    cell: input.cell,
    lastSeq: input.lastSeq,
    ownerClass: columnsOf(input.ownerClass),
    owner: input.owner,
    ride:
      words > NONE && input.ride !== undefined
        ? { law: MOUNT.id, words: input.ride.slice(NONE, words) }
        : undefined,
    visible: input.visible,
    baseline: baselineOf(input),
    ...(input.due === undefined ? {} : { due: input.due }),
    classOf: (handle: number): ClassColumns | undefined => {
      const cls = input.classOf(handle)
      return cls === undefined ? undefined : columnsOf(cls)
    },
  }
}

/** A v0 receiver baseline as a v1 raw frame. */
function rawBase(base: Readonly<DecodedFrame> | null): RawFrame | undefined {
  if (base === null) {
    return undefined
  }
  const { ride, ...rest } = base
  return {
    ...rest,
    ride: ride === null ? undefined : { law: MOUNT.id, words: ride },
  }
}

/** One captured frame encoded and decoded by v1, as a receiver on the same tables. */
function replay(record: Readonly<CapturedFrame>): {
  readonly input: FrameInput
  readonly raw: RawFrame | undefined
} {
  const input = inputOf(record)
  const base = rawBase(receiverBase(record))
  const v1 = snapshotInput(input)
  const bytes = encodeFrame(v1)
  const [frame] = readRecords(bytes, NONE, bytes.length)
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- a message may hold none
  if (frame === undefined) {
    throw new Error('A frame message holds no record')
  }
  const raw = decodeFrame(
    { bytes, start: frame.start, end: frame.end },
    {
      ownerClass: v1.ownerClass,
      classOf: v1.classOf,
      rideLaw: (id: number): RideLaw | undefined =>
        id === MOUNT_LAW.id ? MOUNT_LAW : undefined,
      baseline: (): RawFrame | undefined => base,
    },
  )
  return { input, raw }
}

export { columnsOf, replay, snapshotInput }
