/* oxlint-disable no-bitwise -- a bit reader shifts and masks by definition */
import { WireDecodeError } from './wire-error.ts'

import type { BitSource } from './bit-io.ts'

const BYTE = 8
const LOW_BITS = 7
const SHIFT_BYTE = 3
const WORD = 32
const ZERO = 0
const ONE = 1
const F64_BYTES = 8
const SECOND_WORD = 4

const scratch = new DataView(new ArrayBuffer(F64_BYTES))

/** Reads one body, `bytes[start, end)`; it never reads past it. */
class BitReader implements BitSource {
  private bit: number
  private readonly stop: number
  private readonly bytes: Readonly<Uint8Array>

  public constructor(bytes: Readonly<Uint8Array>, start: number, end: number) {
    this.bytes = bytes
    this.bit = start * BYTE
    this.stop = end * BYTE
  }

  public get remaining(): number {
    return this.stop - this.bit
  }

  // oxlint-disable-next-line max-statements -- the hot path, inlined for WB2's decode budget
  public read(bits: number): number {
    let { bit } = this
    if (bits > this.stop - bit) {
      throw new WireDecodeError('A record body ends early')
    }
    const { bytes } = this
    let value = ZERO
    let left = bits
    while (left > ZERO) {
      const room = BYTE - (bit & LOW_BITS)
      const take = room < left ? room : left
      const byte = bytes[bit >>> SHIFT_BYTE] ?? ZERO
      value =
        value * (ONE << take) +
        ((byte >>> (room - take)) & ((ONE << take) - ONE))
      bit += take
      left -= take
    }
    this.bit = bit
    return value
  }

  public readF32(): number {
    scratch.setUint32(ZERO, this.read(WORD))
    return scratch.getFloat32(ZERO)
  }

  public readF64(): number {
    const high = this.read(WORD)
    scratch.setUint32(SECOND_WORD, this.read(WORD))
    scratch.setUint32(ZERO, high)
    return scratch.getFloat64(ZERO)
  }

  public end(): void {
    const left = this.remaining
    if (left >= BYTE || (left > ZERO && this.read(left) !== ZERO)) {
      throw new WireDecodeError('A record body has trailing bits')
    }
  }
}

export { BitReader }
