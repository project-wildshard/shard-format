import { BitWriter } from '../../frozen/v0/bits.ts'
import { POLICY, distribution } from './benchmark-stats.ts'
import { bytesText, textBytes } from './frame-data.ts'
import { preparePacket } from './packet-replay.ts'
import { prepareFrame } from './prepared-frame.ts'
import { readSessionArchive } from './session-archive.ts'
import { readGraphSession } from './session-graph.ts'

import type { BytesReading } from './benchmark-stats.ts'
import type { PreparedPacket } from './packet-replay.ts'
import type { PreparedFrame } from './prepared-frame.ts'
import type { CapturedSession } from './session-data.ts'

interface Task {
  readonly stream: string
  readonly direction: 'up' | 'down'
  readonly bytes: number
  readonly delivered: boolean
  readonly payload:
    | { readonly frame: PreparedFrame }
    | { readonly packet: PreparedPacket }
}
interface PreparedTraffic {
  readonly product: string
  readonly ticks: number
  readonly tasks: readonly Task[]
  readonly frameBytes: readonly number[]
}
const ZERO = 0
const ONE = 1
const DOWN_CAPACITY = 4096
const UP_CAPACITY = 1024
const HANDSHAKE = new Set(['hello', 'welcome'])
async function recording(
  header: unknown,
  read: (file: string) => Promise<Readonly<Uint8Array>>,
): Promise<CapturedSession> {
  return typeof header === 'object' &&
    header !== null &&
    'format' in header &&
    header.format === 'wire-capture-graph/1'
    ? await readGraphSession(header, read)
    : await readSessionArchive(header, read)
}
function assertActual(
  actual: Readonly<Uint8Array>,
  expected: Readonly<Uint8Array>,
): void {
  if (bytesText(actual) !== bytesText(expected)) {
    throw new Error('Shared-writer frozen replay differs before benchmark')
  }
}
/** Mandatory complete byte equality before any timing consumer receives tasks. */
async function prepareTraffic(
  header: unknown,
  read: (file: string) => Promise<Readonly<Uint8Array>>,
): Promise<PreparedTraffic> {
  const session = await recording(header, read)
  const frames = session.frames.map(prepareFrame)
  const down = new BitWriter(DOWN_CAPACITY)
  const up = new BitWriter(UP_CAPACITY)
  const tasks = session.packets.map((packet): Task => {
    const source =
      'frame' in packet ? frames[packet.frame] : preparePacket(packet.packet)
    if (source === undefined) {
      throw new Error('Missing actual frame packet')
    }
    const bytes =
      'frame' in packet
        ? frames[packet.frame]?.bytes
        : textBytes(packet.packet.bytes)
    if (bytes === undefined) {
      throw new Error('Missing actual packet bytes')
    }
    const encode = 'encodeWith' in source ? source.encodeWith : source.encode
    const actual = new Uint8Array(
      encode((): BitWriter => (packet.direction === 'down' ? down : up)),
    )
    assertActual(actual, bytes)
    return {
      direction: packet.direction,
      delivered: packet.delivered,
      stream: 'stream' in source ? source.stream : 'frame',
      bytes: bytes.byteLength,
      payload: 'encodeWith' in source ? { packet: source } : { frame: source },
    }
  })
  if (tasks.length * POLICY.meanPasses < POLICY.minimumOperations) {
    throw new Error('Capture has too few operations for the fixed benchmark')
  }
  return {
    product: session.product,
    ticks: session.ticks,
    tasks,
    frameBytes: frames.map((frame): number => frame.bytes.byteLength),
  }
}
/** Mutable accounting stays private; consumers receive read-only plain values. */
class ByteBook {
  private readonly steady = { up: ZERO, down: ZERO }
  private readonly handshake = { up: ZERO, down: ZERO }
  private readonly streams: Record<
    string,
    { packets: number; bytes: number; maxBytes: number; delivered: number }
  > = {}
  public add(task: Task): void {
    const totals = HANDSHAKE.has(task.stream) ? this.handshake : this.steady
    totals[task.direction] += task.bytes
    const key = `${task.direction}:${task.stream}`
    const row = this.streams[key] ?? {
      packets: ZERO,
      bytes: ZERO,
      maxBytes: ZERO,
      delivered: ZERO,
    }
    row.packets += ONE
    row.bytes += task.bytes
    row.maxBytes = Math.max(row.maxBytes, task.bytes)
    row.delivered += Number(task.delivered)
    this.streams[key] = row
  }
  public reading(traffic: PreparedTraffic): BytesReading {
    return {
      product: traffic.product,
      ticks: traffic.ticks,
      frameBytes: distribution(traffic.frameBytes),
      steadyBytes: this.steady,
      handshakeBytes: this.handshake,
      streams: this.streams,
    }
  }
}
function trafficBytes(traffic: PreparedTraffic): BytesReading {
  const book = new ByteBook()
  for (const task of traffic.tasks) {
    book.add(task)
  }
  return book.reading(traffic)
}
export {
  prepareTraffic,
  trafficBytes,
  DOWN_CAPACITY,
  UP_CAPACITY,
  type Task,
  type PreparedTraffic,
}
