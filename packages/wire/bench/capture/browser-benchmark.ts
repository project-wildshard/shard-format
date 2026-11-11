import { prepareTraffic, recording } from './benchmark-data.ts'
import { POLICY } from './benchmark-stats.ts'
import { measureTraffic, benchmarkSink } from './benchmark.ts'
import { prepareV1Traffic } from './v1-traffic.ts'

import type { PreparedTraffic } from './benchmark-data.ts'
import type { BenchmarkReading } from './benchmark-stats.ts'

const held: { traffic?: PreparedTraffic } = {}
const NAMES = new Set(['walking', 'fight', 'ride', 'dense'])
/** Which codec replays the recording: frozen v0 (WS3) or v1 (WB2). */
type Codec = 'v0' | 'v1'
async function get(name: string, file: string): Promise<Uint8Array> {
  const response = await fetch(`/recordings/${name}/${file}`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Recording HTTP ${String(response.status)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
async function prepare(name: string, codec: Codec = 'v0'): Promise<void> {
  if (!NAMES.has(name)) {
    throw new Error('Unknown benchmark recording')
  }
  delete held.traffic
  const header: unknown = JSON.parse(
    new TextDecoder().decode(await get(name, 'manifest.json')),
  )
  const read = async (file: string): Promise<Uint8Array> =>
    await get(name, file)
  held.traffic =
    codec === 'v1'
      ? prepareV1Traffic(await recording(header, read))
      : await prepareTraffic(header, read)
}
function measure(): BenchmarkReading {
  const { traffic } = held
  const isolated: unknown = Reflect.get(globalThis, 'crossOriginIsolated')
  if (isolated !== true || traffic === undefined) {
    throw new Error(
      'Benchmark requires prepared traffic and an isolated high-resolution clock',
    )
  }
  return measureTraffic(traffic)
}
function release(): void {
  delete held.traffic
  benchmarkSink.value = undefined
}
Object.assign(globalThis, {
  wireBenchmark: Object.freeze({
    policy: POLICY,
    sink: benchmarkSink,
    prepare,
    measure,
    release,
  }),
})
