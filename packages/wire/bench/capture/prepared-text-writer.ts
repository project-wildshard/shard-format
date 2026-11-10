import { BitWriter } from '../../frozen/v0/bits.ts'

import type { TextValue } from './original-text-writer.ts'

const ZERO = 0
const ONE = 1

/** Used only for records containing a BOM; ordinary captures use BitWriter. */
class PreparedTextWriter extends BitWriter {
  private index = ZERO
  private readonly values: readonly TextValue[]
  public constructor(values: readonly TextValue[]) {
    super()
    this.values = values
  }
  public override writeText(text: string): void {
    const value = this.values[this.index]
    this.index += ONE
    if (value === undefined || value.decoded !== text) {
      throw new Error('Captured text sequence differs')
    }
    super.writeText(value.original)
  }
  public override finish(): ArrayBuffer {
    if (this.index !== this.values.length) {
      throw new Error('Captured text sequence is incomplete')
    }
    return super.finish()
  }
}

export { PreparedTextWriter }
