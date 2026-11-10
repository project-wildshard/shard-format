import { BitWriter } from '../../frozen/v0/bits.ts'
import { decodeFrame, encodeFrame } from '../../frozen/v0/frame.ts'
import { assertDecodedFrame } from './decoded-frame.ts'
import {
  bytesText,
  textBytes,
  unpackDoubles,
  unpackWords,
} from './frame-data.ts'
import { frozenClass, missingBaseline, world } from './frame-world.ts'

import type {
  DecodedFrame,
  FrameInput,
  WorldFrame,
  FrameTable,
} from '../../frozen/v0/frame.ts'
import type { NetClass } from '../../frozen/v0/schema.ts'
import type { CapturedFrame } from './frame-data.ts'

interface PreparedFrame {
  readonly bytes: Readonly<Uint8Array>
  readonly encode: (writer: () => BitWriter) => ArrayBuffer
  readonly decode: () => DecodedFrame
}

const ZERO = 0

function compact(snapshot: CapturedFrame['frame']): WorldFrame {
  const value = world(snapshot)
  const length = snapshot.rows.reduce(
    (size, row): number => size + frozenClass(row.classId).row.length,
    ZERO,
  )
  value.data = value.data.slice(ZERO, length)
  return value
}

function sources(
  record: CapturedFrame,
): ReadonlyMap<number, WorldFrame | null> {
  const rows = new Map<number, WorldFrame | null>()
  const identities = new Map<number, string>()
  for (const call of record.rowFromCalls) {
    const identity = JSON.stringify(call.source)
    if (
      identities.has(call.handle) &&
      identities.get(call.handle) !== identity
    ) {
      throw new Error('A captured rowFrom source changes during one frame')
    }
    identities.set(call.handle, identity)
    rows.set(
      call.handle,
      call.source === undefined ? missingBaseline() : compact(call.source),
    )
  }
  return rows
}

function dues(record: CapturedFrame): ReadonlyMap<number, boolean> {
  const values = new Map<number, boolean>()
  for (const call of record.dueCalls) {
    if (values.has(call.handle) && values.get(call.handle) !== call.value) {
      throw new Error('A captured due decision changes during one frame')
    }
    values.set(call.handle, call.value)
  }
  return values
}

function senderBase(record: CapturedFrame): FrameInput['baseline'] {
  const rows = sources(record)
  const base = record.baseline
  if (base === undefined) {
    return missingBaseline()
  }
  return {
    frame: compact(base.frame),
    visible: new Set(base.visible),
    ...(base.hasRowFrom
      ? {
          rowFrom: (handle: number): WorldFrame | null => {
            if (!rows.has(handle)) {
              throw new Error('Uncaptured rowFrom handle')
            }
            return rows.get(handle) ?? missingBaseline()
          },
        }
      : {}),
  }
}

function inputOf(record: CapturedFrame): FrameInput {
  const decisions = dues(record)
  const classes = new Map(
    record.classes.map((entry): readonly [number, NetClass<never>] => [
      entry.handle,
      frozenClass(entry.id),
    ]),
  )
  return {
    frame: compact(record.frame),
    cell: record.cell,
    lastSeq: record.lastSeq,
    ownerClass: frozenClass(record.ownerClass),
    owner: unpackDoubles(record.owner),
    visible: new Set(record.visible),
    baseline: senderBase(record),
    classOf: (handle: number): NetClass<never> | undefined =>
      classes.get(handle),
    ...(record.hasDue
      ? {
          due: (handle: number): boolean => {
            const value = decisions.get(handle)
            if (value === undefined) {
              throw new Error('Uncaptured due handle')
            }
            return value
          },
        }
      : {}),
    ...(record.ride === undefined ? {} : { ride: unpackDoubles(record.ride) }),
    ...(record.rideWords === undefined ? {} : { rideWords: record.rideWords }),
  }
}

/** Reconstruct the receiver baseline from the actual per-handle sources,
 * never substitute the global frame for an older held row. */
function receiverRows(
  record: CapturedFrame,
  base: NonNullable<CapturedFrame['baseline']>,
): Map<number, Uint32Array> {
  const rows = new Map(
    base.frame.rows
      .filter((row): boolean => frozenClass(row.classId).row.length > ZERO)
      .map((row): readonly [number, Uint32Array] => [
        row.handle,
        unpackWords(row.words),
      ]),
  )
  if (base.hasRowFrom) {
    for (const call of record.rowFromCalls) {
      const row = call.source?.rows.find(
        (entry): boolean => entry.handle === call.handle,
      )
      if (row === undefined) {
        rows.delete(call.handle)
      } else {
        rows.set(call.handle, unpackWords(row.words))
      }
    }
  }
  return rows
}

function receiverBase(record: CapturedFrame): DecodedFrame | null {
  const base = record.baseline
  if (base === undefined) {
    return missingBaseline()
  }
  return {
    tick: base.frame.tick,
    baselineTick: ZERO,
    cell: record.cell,
    lastSeq: record.lastSeq,
    owner: new Float64Array(),
    ride: missingBaseline(),
    rows: receiverRows(record, base),
    fresh: new Set(),
  }
}

function assertPrepared(
  encode: PreparedFrame['encode'],
  expected: string,
): void {
  const proof = new Uint8Array(encode((): BitWriter => new BitWriter()))
  if (bytesText(proof) !== expected) {
    throw new Error('Prepared frame differs from real bytes')
  }
}

/** Inflate fixtures before timing. Timed encode still includes frozen framing,
 * per-handle dispatch, output allocation/copy and writer clearing. */
function prepareFrame(record: CapturedFrame): PreparedFrame {
  const input = inputOf(record)
  const bytes = textBytes(record.bytes)
  const baseline = receiverBase(record)
  const table: FrameTable = {
    ownerClass: input.ownerClass,
    classOf: input.classOf,
    baseline: (tick: number): DecodedFrame | null => {
      if (tick !== baseline?.tick) {
        throw new Error('Receiver baseline tick differs')
      }
      return baseline
    },
  }
  const decode = (): DecodedFrame => {
    const result = decodeFrame(bytes, table)
    if (result === null) {
      throw new Error('Frozen frame benchmark decode refuses real bytes')
    }
    return result
  }
  const encode = (writer: () => BitWriter): ArrayBuffer =>
    encodeFrame(writer(), input)
  assertPrepared(encode, record.bytes)
  assertDecodedFrame(record, decode())
  return { bytes, encode, decode }
}

export { prepareFrame, type PreparedFrame }
