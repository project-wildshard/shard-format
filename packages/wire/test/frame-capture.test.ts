import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  parseFrameCapture,
  unpackDoubles,
} from '../bench/capture/frame-data.ts'
import { assertFrameReplay } from '../bench/capture/frame-replay.ts'
import { FrameTrace } from '../bench/capture/frame-trace.ts'
import { frozenClass, missingBaseline } from '../bench/capture/frame-world.ts'
import { BitWriter } from '../frozen/v0/bits.ts'
import { encodeFrame, WorldFrame } from '../frozen/v0/frame.ts'

import type { CapturedFrame } from '../bench/capture/frame-data.ts'
import type { FrameInput } from '../frozen/v0/frame.ts'
import type { NetClass } from '../frozen/v0/schema.ts'

function classOf(handle: number): NetClass<never> {
  return frozenClass(handle - 1)
}
function frame(tick: number, value: number): WorldFrame {
  const out = new WorldFrame()
  out.reset(tick)
  for (const handle of [1, 2]) {
    const cls = classOf(handle),
      offset = out.claim(handle, cls.row.length)
    for (const [index, column] of cls.row.entries()) {
      out.data[offset + index] = (value + index) % 2 ** column.bits
    }
  }
  return out
}
function baseline(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Frozen ABI carries opaque nominal WorldFrame instances.
  base: NonNullable<FrameInput['baseline']>,
  trace: Readonly<FrameTrace>,
): NonNullable<FrameInput['baseline']> {
  const { rowFrom } = base
  return {
    ...base,
    ...(rowFrom === undefined
      ? {}
      : {
          rowFrom: (handle: number): WorldFrame | null =>
            trace.recordRowFrom(handle, rowFrom(handle)),
        }),
  }
}
function observed(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The tee retains frozen nominal WorldFrame identity.
  input: FrameInput,
  trace: Readonly<FrameTrace>,
): FrameInput {
  const { due } = input
  return {
    ...input,
    classOf: (handle: number): NetClass<never> | undefined =>
      trace.recordClass(handle, input.classOf(handle)),
    baseline:
      input.baseline === null
        ? missingBaseline()
        : baseline(input.baseline, trace),
    ...(due === undefined
      ? {}
      : {
          due: (handle: number): boolean =>
            trace.recordDue(handle, due(handle)),
        }),
  }
}
function capture(evicted = false): CapturedFrame {
  const current = frame(5, 5),
    globalFrame = frame(4, 4),
    later = frame(2, 2),
    old = frame(1, 1)
  const source = (handle: number): WorldFrame | null => {
    if (evicted) {
      return missingBaseline()
    }
    return handle === 1 ? old : later
  }
  const owner = new Float64Array(frozenClass(0).owner.length)
  owner[0] = -0
  const input: FrameInput = {
    frame: current,
    ownerClass: frozenClass(0),
    owner,
    cell: 2,
    lastSeq: 8,
    visible: new Set([1, 2]),
    baseline: { frame: globalFrame, visible: new Set([1, 2]), rowFrom: source },
    due: (handle: number): boolean => handle !== 2,
    classOf,
  }
  const trace = new FrameTrace()
  const bytes = encodeFrame(new BitWriter(), observed(input, trace))
  return trace.finish(input, bytes)
}

test('capture preserves actual per-handle baseline calls and false due results through JSON', (): void => {
  const record = capture()
  assert.deepEqual(
    record.rowFromCalls.map((call): number | undefined => call.source?.tick),
    [1, 2, 1],
  )
  assert.deepEqual(record.dueCalls, [
    { handle: 1, value: true },
    { handle: 2, value: false },
    { handle: 2, value: false },
  ])
  assert.equal(record.baseline?.frame.tick, 4)
  assert.ok(Object.is(unpackDoubles(record.owner)[0], -0))
  const text = JSON.stringify(record)
  assertFrameReplay(parseFrameCapture(JSON.parse(text)))
})
test('replacing per-handle baselines with the global baseline fails the byte oracle', (): void => {
  const record = capture()
  const { baseline: base } = record
  assert.ok(base !== undefined)
  assert.throws((): void => {
    assertFrameReplay({
      ...record,
      baseline: { ...base, hasRowFrom: false },
      rowFromCalls: [],
    })
  }, /differs from real bytes/u)
})
test('omitting due produces different bytes and fails before a recording is admitted', (): void => {
  const record = capture()
  const source = record.rowFromCalls.find((call): boolean => call.handle === 2)
  assert.ok(source !== undefined)
  // Supply the extra baseline read caused by sending the previously stale row.
  assert.throws((): void => {
    assertFrameReplay({
      ...record,
      hasDue: false,
      dueCalls: [],
      rowFromCalls: [...record.rowFromCalls, source],
    })
  }, /differs from real bytes/u)
})
test('a missing per-handle baseline remains null rather than falling back to global', (): void => {
  const record = capture(true)
  assert.ok(record.rowFromCalls.length > 0)
  assert.ok(
    record.rowFromCalls.every((call): boolean => call.source === undefined),
  )
  assertFrameReplay(record)
})
