/* oxlint-disable no-bitwise -- a bit packer shifts and masks by definition */
import { putUvarint, uvarintLength } from './framing.ts'

import type { BitSink } from './bit-io.ts'

const BYTE = 8
const LOW_BITS = 7
const SHIFT_BYTE = 3
const WORD = 32
const ZERO = 0
const ONE = 1
const INITIAL_BYTES = 256
const GROWTH = 2
const F64_BYTES = 8
const SECOND_WORD = 4

const scratch = new DataView(new ArrayBuffer(F64_BYTES))
// A float32's bits through an aliased array, as v0 reads them: one element,
// so byte order never enters, and cheaper than a DataView per ride word (WB2).
const floats = new Float32Array(ONE)
const floatBits = new Uint32Array(floats.buffer)

/** Writes one body; `take` detaches it, padded to a byte, and resets. */
class BitWriter implements BitSink {
  private bytes: Uint8Array<ArrayBuffer> = new Uint8Array(INITIAL_BYTES)
  private bit = ZERO

  // oxlint-disable-next-line max-statements -- the hot path, inlined for WB2's encode budget
  public write(value: number, bits: number): void {
    const end = this.bit + bits
    if (end > this.bytes.length * BYTE) {
      this.grow(end)
    }
    const word = value >>> ZERO
    const { bytes } = this
    let { bit } = this
    let left = bits
    while (left > ZERO) {
      const room = BYTE - (bit & LOW_BITS)
      const take = room < left ? room : left
      const at = bit >>> SHIFT_BYTE
      bytes[at] =
        (bytes[at] ?? ZERO) |
        (((word >>> (left - take)) & ((ONE << take) - ONE)) << (room - take))
      bit += take
      left -= take
    }
    this.bit = bit
  }

  public writeF32(value: number): void {
    floats[ZERO] = value
    this.write(floatBits[ZERO] ?? ZERO, WORD)
  }

  public writeF64(value: number): void {
    scratch.setFloat64(ZERO, value)
    this.write(scratch.getUint32(ZERO), WORD)
    this.write(scratch.getUint32(SECOND_WORD), WORD)
  }

  public take(): Uint8Array<ArrayBuffer> {
    const length = Math.ceil(this.bit / BYTE)
    const out = this.bytes.slice(ZERO, length)
    this.bytes.fill(ZERO, ZERO, length)
    this.bit = ZERO
    return out
  }

  public takeRecord(tag: number): Uint8Array<ArrayBuffer> {
    const length = Math.ceil(this.bit / BYTE)
    const head = uvarintLength(tag) + uvarintLength(length)
    const out = new Uint8Array(head + length)
    putUvarint(out, putUvarint(out, ZERO, tag), length)
    out.set(this.bytes.subarray(ZERO, length), head)
    this.bytes.fill(ZERO, ZERO, length)
    this.bit = ZERO
    return out
  }

  private grow(bits: number): void {
    const size = Math.max(this.bytes.length * GROWTH, Math.ceil(bits / BYTE))
    const next = new Uint8Array(size)
    next.set(this.bytes)
    this.bytes = next
  }
}

export { BitWriter }
