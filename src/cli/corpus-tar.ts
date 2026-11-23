/** A downloaded original's first bytes: plain tarball or Brotli (FE3). */
import { open } from 'node:fs/promises'

const NONE = 0
const TAR_MAGIC_AT = 257
const TAR_MAGIC = 'ustar'
const PEEK_BYTES = 512

/** Whether the first bytes are a plain tarball (`ustar` at 257) rather than Brotli. */
function isPlainTar(head: Readonly<Uint8Array>): boolean {
  const magic = new TextDecoder().decode(
    head.subarray(TAR_MAGIC_AT, TAR_MAGIC_AT + TAR_MAGIC.length),
  )
  return magic === TAR_MAGIC
}

async function firstBytes(file: string): Promise<Uint8Array> {
  const handle = await open(file)
  try {
    const bytes = new Uint8Array(PEEK_BYTES)
    await handle.read(bytes, NONE, PEEK_BYTES, NONE)
    return bytes
  } finally {
    await handle.close()
  }
}

export { firstBytes, isPlainTar }
