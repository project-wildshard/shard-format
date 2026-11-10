import { BitWriter } from '../../frozen/v0/bits.ts'
import { DOWN_CAPACITY, UP_CAPACITY, trafficBytes } from './benchmark-data.ts'
import { POLICY, distribution } from './benchmark-stats.ts'

import type { PreparedTraffic } from './benchmark-data.ts'
import type {
  Distribution,
  CpuReading,
  BenchmarkReading,
} from './benchmark-stats.ts'

interface Runner {
  readonly indices: readonly number[]
  readonly operation: (index: number) => void
  readonly pass: () => void
}
const ZERO = 0
const ONE = 1
// Exported escape prevents treating decoded objects/output copies as dead work.
const benchmarkSink: { value: unknown } = { value: undefined }
function runner(traffic: PreparedTraffic, mode: 'encode' | 'decode'): Runner {
  const writers = {
    down: new BitWriter(DOWN_CAPACITY),
    up: new BitWriter(UP_CAPACITY),
  }
  const select = {
    down: (): BitWriter => writers.down,
    up: (): BitWriter => writers.up,
  }
  const indices = traffic.tasks.flatMap((task, index): number[] =>
    mode === 'encode' || task.delivered ? [index] : [],
  )
  if (indices.length * POLICY.meanPasses < POLICY.minimumOperations) {
    throw new Error('Too few actual delivered decode operations')
  }
  const operation = (index: number): void => {
    const task = traffic.tasks[index]
    if (task === undefined) {
      throw new Error('Missing benchmark traffic index')
    }
    const { payload } = task
    if ('frame' in payload) {
      benchmarkSink.value =
        mode === 'decode'
          ? payload.frame.decode()
          : payload.frame.encode(select[task.direction])
      return
    }
    benchmarkSink.value =
      mode === 'decode'
        ? payload.packet.decode()
        : payload.packet.encodeWith(select[task.direction])
  }
  const pass = (): void => {
    for (const index of indices) {
      operation(index)
    }
  }
  return { indices, operation, pass }
}
function mean(
  run: Runner,
  now: () => number,
): { value: number; passes: readonly number[] } {
  const observed: { elapsed: number; passes: number[] } = {
    elapsed: ZERO,
    passes: [],
  }
  for (let warm = ZERO; warm < POLICY.warmPasses; warm += ONE) {
    run.pass()
  }
  for (let sample = ZERO; sample < POLICY.meanPasses; sample += ONE) {
    const start = now()
    run.pass()
    const duration = now() - start
    observed.elapsed += duration
    observed.passes.push(duration)
  }
  return {
    value: observed.elapsed / (run.indices.length * POLICY.meanPasses),
    passes: observed.passes,
  }
}
class Samples {
  private readonly values: number[] = []
  private zeroSamples = ZERO
  private minimumPositive = Infinity
  private readonly distinct = new Set<number>()
  private readonly streams: Record<string, number[]> = {}
  public add(key: string, value: number): void {
    if (!(Number.isFinite(value) && value >= ZERO)) {
      throw new Error('Invalid sampled CPU clock')
    }
    this.zeroSamples += Number(value === ZERO)
    this.minimumPositive =
      value > ZERO
        ? Math.min(value, this.minimumPositive)
        : this.minimumPositive
    this.distinct.add(value)
    this.values.push(value)
    const group = this.streams[key] ?? []
    group.push(value)
    this.streams[key] = group
  }
  public reading(): {
    readonly all: Distribution
    readonly raw: readonly number[]
    readonly resolution: {
      readonly zeroSamples: number
      readonly minimumPositiveMs: number
      readonly distinctSamples: number
    }
    readonly streams: Readonly<Record<string, Distribution>>
  } {
    return {
      all: distribution(this.values),
      raw: this.values,
      resolution: {
        zeroSamples: this.zeroSamples,
        minimumPositiveMs: Number.isFinite(this.minimumPositive)
          ? this.minimumPositive
          : ZERO,
        distinctSamples: this.distinct.size,
      },
      streams: Object.fromEntries(
        Object.keys(this.streams).map(
          (key): readonly [string, Distribution] => [
            key,
            distribution(this.streams[key] ?? []),
          ],
        ),
      ),
    }
  }
}
function samples(
  traffic: PreparedTraffic,
  run: Runner,
  now: () => number,
): ReturnType<Samples['reading']> {
  const book = new Samples()
  const one = (index: number): void => {
    const task = traffic.tasks[index]
    if (task === undefined) {
      throw new Error('Missing sampled packet')
    }
    const start = now()
    run.operation(index)
    const end = now()
    book.add(`${task.direction}:${task.stream}`, end - start)
  }
  for (let sample = ZERO; sample < POLICY.samplePasses; sample += ONE) {
    for (const index of run.indices) {
      one(index)
    }
  }
  return book.reading()
}
function clockResolution(
  now: () => number,
): ReturnType<Samples['reading']>['resolution'] {
  const book = new Samples()
  for (let index = ZERO; index < POLICY.clockPairs; index += ONE) {
    const start = now()
    const end = now()
    book.add('clock', end - start)
  }
  return book.reading().resolution
}
function cpu(
  traffic: PreparedTraffic,
  mode: 'encode' | 'decode',
  now: () => number,
): CpuReading {
  const clock = clockResolution(now)
  const run = runner(traffic, mode)
  const measured = mean(run, now)
  const sampled = samples(traffic, run, now)
  return {
    meanMs: measured.value,
    meanPassesMs: measured.passes,
    clock,
    sampleResolution: sampled.resolution,
    samplesMs: sampled.raw,
    p95Ms: sampled.all.p95,
    sampled: sampled.all,
    streams: sampled.streams,
    operations:
      run.indices.length *
      (POLICY.warmPasses + POLICY.meanPasses + POLICY.samplePasses),
  }
}
/** Framing/dispatch, per-handle lookups/masks, output copying/allocation and writer clearing remain timed. */
function measureTraffic(
  traffic: PreparedTraffic,
  now: () => number = (): number => performance.now(),
): BenchmarkReading {
  const bytes = trafficBytes(traffic)
  return {
    ...bytes,
    encode: cpu(traffic, 'encode', now),
    decode: cpu(traffic, 'decode', now),
  }
}
export { measureTraffic, benchmarkSink }
