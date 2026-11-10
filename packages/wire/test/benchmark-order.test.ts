import assert from 'node:assert/strict'
import { test } from 'node:test'

import { POLICY } from '../bench/capture/benchmark-stats.ts'
import { measureTraffic, benchmarkSink } from '../bench/capture/benchmark.ts'
import {
  encodePacketInput,
  decodePacketValue,
} from '../bench/capture/packet-input.ts'
import { BitWriter } from '../frozen/v0/bits.ts'
import { ObservedBytes } from './helpers/benchmark-bytes.ts'

import type { Task } from '../bench/capture/benchmark-data.ts'
import type { BenchmarkReading } from '../bench/capture/benchmark-stats.ts'
import type { PreparedPacket } from '../bench/capture/packet-replay.ts'

const COPIES = 129
const ZERO = 0
const ONE = 1
const TWO = 2
const HELLO = {
  schemaHash: 0,
  build: 'order-contract',
  player: 'local-contract',
  name: 'Protocol observer',
  ledger: 0,
}
class Contract {
  private readonly events: string[] = []
  private inside = false
  private clock = ZERO
  public readonly now = (): number => {
    this.inside = !this.inside
    this.clock += ONE
    return this.clock
  }
  private event(name: string): void {
    this.events.push(`${name}:${this.inside ? 'timed' : 'warm'}`)
  }
  private input(): Parameters<typeof encodePacketInput>[0] {
    const observe = (): void => {
      this.event('dispatch')
    }
    return {
      get kind(): 'hello' {
        observe()
        return 'hello'
      },
      value: HELLO,
    }
  }
  private packet(name: string): PreparedPacket {
    const input = this.input()
    const bytes = new ObservedBytes(
      new Uint8Array(
        encodePacketInput(input, (): BitWriter => new BitWriter()),
      ),
      (): void => {
        this.event('prefix')
      },
    )
    return {
      stream: 'hello',
      encode: (): ArrayBuffer =>
        encodePacketInput(input, (): BitWriter => new BitWriter()),
      encodeWith: (shared): ArrayBuffer => {
        this.events.push(`encode:${name}`)
        return encodePacketInput(input, shared)
      },
      decode: (): unknown => {
        this.events.push(`decode:${name}`)
        return decodePacketValue(bytes)
      },
    }
  }
  private task(
    name: string,
    direction: 'up' | 'down',
    delivered: boolean,
  ): Task {
    const packet = this.packet(name)
    const metadata = (): string => {
      assert.equal(
        this.inside,
        false,
        'Reporting metadata must never occur between the codec clock pair',
      )
      return 'hello'
    }
    return {
      direction,
      delivered,
      bytes: packet.encode().byteLength,
      get stream(): string {
        return metadata()
      },
      payload: { packet },
    }
  }
  private orders(): void {
    const encodes = this.events.filter((event): boolean =>
      event.startsWith('encode:'),
    )
    const decodes = this.events.filter((event): boolean =>
      event.startsWith('decode:'),
    )
    const passes = POLICY.warmPasses + POLICY.meanPasses + POLICY.samplePasses
    assert.equal(encodes.length, COPIES * TWO * passes)
    for (const [index, event] of encodes.entries()) {
      assert.equal(event, index % TWO === ZERO ? 'encode:first' : 'encode:lost')
    }
    assert.equal(decodes.length, COPIES * passes)
    assert.ok(decodes.every((event): boolean => event === 'decode:first'))
  }
  private dispatches(): void {
    const passes = POLICY.meanPasses + POLICY.samplePasses
    assert.equal(
      this.events.filter((event): boolean => event === 'dispatch:timed').length,
      COPIES * TWO * passes,
    )
    assert.equal(
      this.events.filter((event): boolean => event === 'prefix:timed').length,
      COPIES * passes,
    )
  }
  private result(value: BenchmarkReading): void {
    assert.equal(
      value.encode.samplesMs.length,
      COPIES * TWO * POLICY.samplePasses,
    )
    assert.equal(value.decode.samplesMs.length, COPIES * POLICY.samplePasses)
    assert.deepEqual(benchmarkSink.value, HELLO)
    assert.equal(this.inside, false)
  }
  public run(): void {
    const pair = [
      this.task('first', 'up', true),
      this.task('lost', 'down', false),
    ]
    const tasks = Array.from(
      { length: COPIES },
      (): readonly Task[] => pair,
    ).flat()
    this.events.length = ZERO
    const result = measureTraffic(
      { product: 'harness-order-contract', ticks: 60, tasks, frameBytes: [] },
      this.now,
    )
    this.orders()
    this.dispatches()
    this.result(result)
  }
}
test('actual codec dispatch retains order, lost sends, delivered-only decode and exact clock boundaries', (): void => {
  try {
    new Contract().run()
  } finally {
    benchmarkSink.value = undefined
  }
})
