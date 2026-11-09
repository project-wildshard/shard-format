import { bytesText, packDoubles, parseFrameCapture } from './frame-data.ts'
import { assertFrameReplay } from './frame-replay.ts'
import { frozenClass, snapshot } from './frame-world.ts'

import type { CapturedFrame, DueCall, RowCall } from './frame-data.ts'
import type { FrameView, ClassView } from './frame-world.ts'

interface FrameCaptureInput {
  readonly frame: FrameView
  readonly cell: number
  readonly lastSeq: number
  readonly ownerClass: { readonly id: number }
  readonly owner: Readonly<Float64Array>
  readonly ride?: Readonly<Float64Array>
  readonly rideWords?: number
  readonly visible: ReadonlySet<number>
  readonly baseline: {
    readonly frame: FrameView
    readonly visible: ReadonlySet<number>
    readonly rowFrom?: (handle: number) => FrameView | null
  } | null
  readonly due?: (handle: number) => boolean
}

/** Tee actual callback calls; never re-evaluate rowFrom or due after encode. */
class FrameTrace {
  private readonly classes = new Map<number, number>()
  private readonly rows: RowCall[] = []
  private readonly dues: DueCall[] = []
  public recordClass<Class extends ClassView | undefined>(
    handle: number,
    cls: Class,
  ): Class {
    if (cls !== undefined) {
      const expected = frozenClass(cls.id)
      if (
        cls.row.length !== expected.row.length ||
        cls.row.some(
          (column: { readonly bits: number }, index: number): boolean =>
            column.bits !== expected.row[index]?.bits,
        )
      ) {
        throw new Error('Captured class differs from frozen v0')
      }
      this.classes.set(handle, cls.id)
    }
    return cls
  }
  public recordRowFrom<Frame extends FrameView | null>(
    handle: number,
    frame: Frame,
  ): Frame {
    this.rows.push({
      handle,
      ...(frame === null
        ? {}
        : { source: snapshot(frame, [handle], this.classes) }),
    })
    return frame
  }
  public recordDue(handle: number, value: boolean): boolean {
    this.dues.push({ handle, value })
    return value
  }
  private record(input: FrameCaptureInput, bytes: ArrayBuffer): CapturedFrame {
    const base = input.baseline
    return {
      frame: snapshot(input.frame, [...input.visible], this.classes),
      cell: input.cell,
      lastSeq: input.lastSeq,
      ownerClass: input.ownerClass.id,
      owner: packDoubles(input.owner),
      visible: [...input.visible],
      ...(input.ride === undefined
        ? {}
        : { ride: packDoubles(input.ride), rideWords: input.rideWords }),
      ...(base === null
        ? {}
        : {
            baseline: {
              frame: snapshot(base.frame, [...base.visible], this.classes),
              visible: [...base.visible],
              hasRowFrom: base.rowFrom !== undefined,
            },
          }),
      classes: [...this.classes].map(
        ([handle, id]: readonly [number, number]): {
          readonly handle: number
          readonly id: number
        } => ({ handle, id }),
      ),
      hasDue: input.due !== undefined,
      rowFromCalls: this.rows,
      dueCalls: this.dues,
      bytes: bytesText(new Uint8Array(bytes)),
    }
  }
  /** Mandatory byte oracle before a record can reach the recording or gate. */
  public finish(input: FrameCaptureInput, bytes: ArrayBuffer): CapturedFrame {
    // Exercise the actual JSON recording boundary, preserving doubles as bits.
    const text = JSON.stringify(this.record(input, bytes))
    const record = parseFrameCapture(JSON.parse(text))
    assertFrameReplay(record)
    return record
  }
}

export { FrameTrace, type FrameCaptureInput }
