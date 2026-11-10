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
    benchmarkSink.value =
      mode === 'decode' ? task.decode() : task.encode(select[task.direction])
  }
  const pass = (): void => {
    for (const index of indices) {
      operation(index)
    }
  }
  return { indices, operation, pass }
}
function mean(run: Runner, now: () => number): number {
  let elapsed = ZERO
  for (let warm = ZERO; warm < POLICY.warmPasses; warm += ONE) {
    run.pass()
  }
  for (let sample = ZERO; sample < POLICY.meanPasses; sample += ONE) {
    const start = now()
    run.pass()
    elapsed += now() - start
  }
  return elapsed / (run.indices.length * POLICY.meanPasses)
}
class Samples {
  private readonly values: number[] = []
  private readonly streams: Record<string, number[]> = {}
  public add(key: string, value: number): void {
    if (!(Number.isFinite(value) && value >= ZERO)) {
      throw new Error('Invalid sampled CPU clock')
    }
    this.values.push(value)
    const group = this.streams[key] ?? []
    group.push(value)
    this.streams[key] = group
  }
  public reading(): {
    readonly all: Distribution
    readonly streams: Readonly<Record<string, Distribution>>
  } {
    return {
      all: distribution(this.values),
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
    book.add(`${task.direction}:${task.stream}`, now() - start)
  }
  for (let sample = ZERO; sample < POLICY.samplePasses; sample += ONE) {
    for (const index of run.indices) {
      one(index)
    }
  }
  return book.reading()
}
function cpu(
  traffic: PreparedTraffic,
  mode: 'encode' | 'decode',
  now: () => number,
): CpuReading {
  const run = runner(traffic, mode)
  const meanMs = mean(run, now)
  const sampled = samples(traffic, run, now)
  return {
    meanMs,
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
