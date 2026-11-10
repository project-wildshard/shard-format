import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compareRuns, distribution } from '../bench/capture/benchmark-stats.ts'

import type { BenchmarkReading } from '../bench/capture/benchmark-stats.ts'

function reading(mean: number, p95: number): BenchmarkReading {
  const sampled = distribution([mean, p95])
  const cpu = {
    meanMs: mean,
    p95Ms: p95,
    sampled,
    streams: {},
    operations: 4096,
  }
  return {
    product: 'statistics-contract',
    ticks: 60,
    frameBytes: distribution([40, 80]),
    steadyBytes: { up: 100, down: 200 },
    handshakeBytes: { up: 10, down: 20 },
    streams: {
      'down:frame': { packets: 2, bytes: 120, maxBytes: 80, delivered: 2 },
    },
    encode: cpu,
    decode: cpu,
  }
}
test('nearest-rank p95 and complete mean retain every sample', (): void => {
  assert.deepEqual(
    distribution(
      Array.from({ length: 20 }, (_value, index): number => index + 1),
    ),
    { count: 20, total: 210, mean: 10.5, p95: 19 },
  )
  assert.deepEqual(distribution([]), { count: 0, total: 0, mean: 0, p95: 0 })
})
test('two-run stability requires strictly below three percent on all four primary clocks', (): void => {
  assert.equal(compareRuns(reading(100, 100), reading(102.99, 102.99)).ok, true)
  assert.equal(compareRuns(reading(100, 100), reading(103, 100)).ok, false)
  assert.equal(compareRuns(reading(100, 100), reading(100, 103)).ok, false)
})
test('matching clocks cannot excuse different frame stream handshake or direction bytes', (): void => {
  const base = reading(100, 100)
  for (const changed of [
    { ...base, frameBytes: distribution([41, 80]) },
    { ...base, handshakeBytes: { up: 11, down: 20 } },
    { ...base, steadyBytes: { up: 99, down: 200 } },
    { ...base, streams: {} },
  ]) {
    assert.throws((): void => {
      compareRuns(base, changed)
    }, /actual traffic bytes/u)
  }
})
test('zero and non-finite primary clocks cannot qualify as a stable result', (): void => {
  for (const value of [0, -1, Number.NaN, Infinity]) {
    assert.throws((): void => {
      compareRuns(reading(100, 100), reading(value, 100))
    }, /Invalid primary CPU/u)
  }
})
