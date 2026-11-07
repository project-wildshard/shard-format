// Where ustar keeps each header field, for the reader and writer in `tar.ts`.

const BLOCK = 512
const NAME = { at: 0, length: 100 }
const MODE = { at: 100, length: 8 }
const OWNER = { at: 108, length: 8 }
const GROUP = { at: 116, length: 8 }
const SIZE = { at: 124, length: 12 }
const TIME = { at: 136, length: 12 }
const CHECKSUM = { at: 148, length: 8 }
const TYPE_AT = 156
const MAGIC = { at: 257, length: 5 }
const USTAR_VERSION = { at: 263, length: 2 }
const PREFIX = { at: 345, length: 155 }

const SPACE = 32
const START = 0

interface TarField {
  readonly at: number
  readonly length: number
}

/** The header's checksum, with its own field counted as spaces. */
function checksum(block: Readonly<Uint8Array>): number {
  const end = CHECKSUM.at + CHECKSUM.length
  return block.reduce(
    (total: number, byte: number, index: number): number =>
      total + (index >= CHECKSUM.at && index < end ? SPACE : byte),
    START,
  )
}

function padded(size: number): number {
  return Math.ceil(size / BLOCK) * BLOCK
}

export type { TarField }
export {
  BLOCK,
  CHECKSUM,
  GROUP,
  MAGIC,
  MODE,
  NAME,
  OWNER,
  PREFIX,
  SIZE,
  TIME,
  TYPE_AT,
  USTAR_VERSION,
  checksum,
  padded,
}
