import { prepareTraffic } from './benchmark-data.ts'
import { POLICY } from './benchmark-stats.ts'
import { measureTraffic } from './benchmark.ts'

import type { PreparedTraffic } from './benchmark-data.ts'
import type { BenchmarkReading } from './benchmark-stats.ts'

const held: { traffic?: PreparedTraffic } = {}
const NAMES = new Set(['walking', 'fight', 'ride', 'dense'])
async function get(name: string, file: string): Promise<Uint8Array> {
  const response = await fetch(`/recordings/${name}/${file}`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Recording HTTP ${String(response.status)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
async function prepare(name: string): Promise<void> {
  if (!NAMES.has(name)) {
    throw new Error('Unknown benchmark recording')
  }
  delete held.traffic
  const header: unknown = JSON.parse(
    new TextDecoder().decode(await get(name, 'manifest.json')),
  )
  held.traffic = await prepareTraffic(
    header,
    async (file): Promise<Uint8Array> => await get(name, file),
  )
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
}
Object.assign(globalThis, {
  wireBenchmark: Object.freeze({ policy: POLICY, prepare, measure, release }),
})
