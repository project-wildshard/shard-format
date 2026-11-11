/* oxlint-disable no-bitwise -- a bit packer shifts and masks by definition */
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

/** Writes one body; `take` detaches it, padded to a byte, and resets. */
class BitWriter implements BitSink {
  private bytes: Uint8Array<ArrayBuffer> = new Uint8Array(INITIAL_BYTES)
  private bit = ZERO

  public write(value: number, bits: number): void {
    const end = this.bit + bits
    if (end > this.bytes.length * BYTE) {
      this.grow(end)
    }
    const word = value >>> ZERO
    for (let left = bits; left > ZERO;) {
      left -= this.put(word, left)
    }
  }

  public writeF32(value: number): void {
    scratch.setFloat32(ZERO, value)
    this.write(scratch.getUint32(ZERO), WORD)
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

  /** Write the next chunk of `word`'s low `left` bits; the bits taken. */
  private put(word: number, left: number): number {
    const room = BYTE - (this.bit & LOW_BITS)
    const take = Math.min(room, left)
    const at = this.bit >>> SHIFT_BYTE
    const chunk = (word >>> (left - take)) & ((ONE << take) - ONE)
    this.bytes[at] = (this.bytes[at] ?? ZERO) | (chunk << (room - take))
    this.bit += take
    return take
  }

  private grow(bits: number): void {
    const size = Math.max(this.bytes.length * GROWTH, Math.ceil(bits / BYTE))
    const next = new Uint8Array(size)
    next.set(this.bytes)
    this.bytes = next
  }
}

export { BitWriter }
