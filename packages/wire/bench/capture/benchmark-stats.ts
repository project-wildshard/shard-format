interface Distribution {
  readonly count: number
  readonly total: number
  readonly mean: number
  readonly p95: number
}
interface TimingResolution {
  readonly zeroSamples: number
  readonly minimumPositiveMs: number
  readonly distinctSamples: number
}
interface CpuReading {
  readonly clock: TimingResolution
  readonly sampleResolution: TimingResolution
  readonly samplesMs: readonly number[]
  /** Every existing full-pass timer pair, in observed order. No added timing work. */
  readonly meanPassesMs: readonly number[]
  readonly meanMs: number
  readonly p95Ms: number
  readonly sampled: Distribution
  readonly streams: Readonly<Record<string, Distribution>>
  readonly operations: number
}
interface BytesReading {
  readonly product: string
  readonly ticks: number
  readonly frameBytes: Distribution
  readonly steadyBytes: Readonly<Record<'up' | 'down', number>>
  readonly handshakeBytes: Readonly<Record<'up' | 'down', number>>
  readonly streams: Readonly<
    Record<
      string,
      {
        readonly packets: number
        readonly bytes: number
        readonly maxBytes: number
        readonly delivered: number
      }
    >
  >
}
interface BenchmarkReading extends BytesReading {
  readonly encode: CpuReading
  readonly decode: CpuReading
}
interface Stability {
  readonly ok: boolean
  readonly differences: Readonly<Record<string, number>>
}
// Fixed before timing. Never adapt samples or select the fastest result.
const POLICY = Object.freeze({
  clockPairs: 1024,
  warmPasses: 16,
  meanPasses: 32,
  samplePasses: 32,
  minimumOperations: 4096,
  runs: 2,
  maximumDifferencePercent: 3,
})
const ZERO = 0
const ONE = 1
const P95 = 0.95
const PERCENT = 100
function distribution(values: readonly number[]): Distribution {
  if (values.length === ZERO) {
    return { count: ZERO, total: ZERO, mean: ZERO, p95: ZERO }
  }
  const sorted = values.toSorted((left, right): number => left - right)
  const total = values.reduce((sum, value): number => sum + value, ZERO)
  return {
    count: values.length,
    total,
    mean: total / values.length,
    p95: sorted[Math.ceil(values.length * P95) - ONE] ?? ZERO,
  }
}
function bytesOfReading(value: BenchmarkReading): BytesReading {
  return {
    product: value.product,
    ticks: value.ticks,
    frameBytes: value.frameBytes,
    steadyBytes: value.steadyBytes,
    handshakeBytes: value.handshakeBytes,
    streams: value.streams,
  }
}
function difference(before: number, after: number): number {
  if (
    !(
      before > ZERO &&
      after > ZERO &&
      Number.isFinite(before) &&
      Number.isFinite(after)
    )
  ) {
    throw new Error('Invalid primary CPU timing')
  }
  return (Math.abs(after - before) / before) * PERCENT
}
function compareRuns(
  first: BenchmarkReading,
  second: BenchmarkReading,
): Stability {
  if (
    JSON.stringify(bytesOfReading(first)) !==
    JSON.stringify(bytesOfReading(second))
  ) {
    throw new Error('Two timing runs changed their actual traffic bytes')
  }
  const modes = ['encode', 'decode'] as const
  const keys = ['meanMs', 'p95Ms'] as const
  const differences = Object.fromEntries(
    modes.flatMap((mode): readonly (readonly [string, number])[] =>
      keys.map((key): readonly [string, number] => [
        `${mode}.${key}`,
        difference(first[mode][key], second[mode][key]),
      ]),
    ),
  )
  return {
    ok: Object.values(differences).every(
      (value): boolean => value < POLICY.maximumDifferencePercent,
    ),
    differences,
  }
}
export {
  POLICY,
  distribution,
  compareRuns,
  type Distribution,
  type CpuReading,
  type BytesReading,
  type BenchmarkReading,
  type Stability,
}
