/** Where a regular file's bytes sit in a tarball. */
interface TarEntry {
  readonly offset: number
  readonly size: number
}

/** A tarball read by position: bytes in memory, or a file on disk. */
interface TarSource {
  readonly length: number
  readonly read: (offset: number, length: number) => Readonly<Uint8Array>
}

export type { TarEntry, TarSource }
