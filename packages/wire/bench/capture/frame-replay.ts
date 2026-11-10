import { BitWriter } from '../../frozen/v0/bits.ts'
import { encodeFrame } from '../../frozen/v0/frame.ts'
import { bytesText, unpackDoubles } from './frame-data.ts'
import {
  world,
  CapturedWorld,
  frozenClass,
  missingBaseline,
} from './frame-world.ts'

import type { FrameInput, WorldFrame } from '../../frozen/v0/frame.ts'
import type { NetClass } from '../../frozen/v0/schema.ts'
import type { CapturedFrame } from './frame-data.ts'

const ZERO = 0
const ONE = 1

class ReplayCalls {
  private readonly record: CapturedFrame
  // Frozen encodeFrame consumes each callback synchronously before its next call.
  // Rebuild every captured source, preserving order and strict width admission,
  // while retiring prior offsets instead of allocating 4 KiB per callback.
  private readonly rowWorld = new CapturedWorld()
  private rowIndex = ZERO
  private dueIndex = ZERO
  public constructor(record: CapturedFrame) {
    this.record = record
  }
  public rowFrom(handle: number): WorldFrame | null {
    const call = this.record.rowFromCalls[this.rowIndex]
    this.rowIndex += ONE
    if (call === undefined || call.handle !== handle) {
      throw new Error('rowFrom capture call mismatch')
    }
    return call.source === undefined
      ? missingBaseline()
      : this.rowWorld.read(call.source)
  }
  public due(handle: number): boolean {
    const call = this.record.dueCalls[this.dueIndex]
    this.dueIndex += ONE
    if (call === undefined || call.handle !== handle) {
      throw new Error('due capture call mismatch')
    }
    return call.value
  }
  public baseline(): FrameInput['baseline'] {
    const base = this.record.baseline
    return base === undefined
      ? missingBaseline()
      : {
          frame: world(base.frame),
          visible: new Set(base.visible),
          ...(base.hasRowFrom
            ? {
                rowFrom: (handle: number): WorldFrame | null =>
                  this.rowFrom(handle),
              }
            : {}),
        }
  }
  public assertConsumed(): void {
    if (
      this.rowIndex !== this.record.rowFromCalls.length ||
      this.dueIndex !== this.record.dueCalls.length
    ) {
      throw new Error('Unused rowFrom/due capture calls')
    }
  }
}

function replayCapturedFrame(record: CapturedFrame): ArrayBuffer {
  const calls = new ReplayCalls(record)
  const classes = new Map(
    record.classes.map(
      (entry: {
        readonly handle: number
        readonly id: number
      }): readonly [number, number] => [entry.handle, entry.id],
    ),
  )
  const result = encodeFrame(new BitWriter(), {
    frame: world(record.frame),
    cell: record.cell,
    lastSeq: record.lastSeq,
    ownerClass: frozenClass(record.ownerClass),
    owner: unpackDoubles(record.owner),
    visible: new Set(record.visible),
    baseline: calls.baseline(),
    classOf: (handle: number): NetClass<never> | undefined => {
      const id = classes.get(handle)
      return id === undefined ? undefined : frozenClass(id)
    },
    ...(record.hasDue
      ? { due: (handle: number): boolean => calls.due(handle) }
      : {}),
    ...(record.ride === undefined ? {} : { ride: unpackDoubles(record.ride) }),
    ...(record.rideWords === undefined ? {} : { rideWords: record.rideWords }),
  })
  calls.assertConsumed()
  return result
}

function assertFrameReplay(record: CapturedFrame): void {
  const bytes = new Uint8Array(replayCapturedFrame(record))
  if (bytesText(bytes) !== record.bytes) {
    throw new Error('Frozen v0 frame replay differs from real bytes')
  }
}

export { replayCapturedFrame, assertFrameReplay }
