// `validateShardfileStream`'s ports from `node:crypto` and `node:zlib`, which
// a Worker has under `nodejs_compat` (API-CLOUDFLARE AC6a). A host adapter,
// not the portable library: tsconfig.lib.json leaves it out.

// oxlint-disable-next-line import/no-nodejs-modules -- a Node and Workers host adapter
import { createHash } from 'node:crypto'
// oxlint-disable-next-line import/no-nodejs-modules -- a Node and Workers host adapter
import { Readable, pipeline } from 'node:stream'
// oxlint-disable-next-line import/no-nodejs-modules -- a Node and Workers host adapter
import { createBrotliDecompress } from 'node:zlib'

import type { StreamHasher } from './shardfile-stream-tar.ts'
import type { StreamValidationPorts } from './shardfile-stream.ts'

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function hasher(): StreamHasher {
  const hash = createHash('sha256')
  return {
    update: (bytes: Readonly<Uint8Array>): void => {
      hash.update(bytes)
    },
    digest: (): string => hash.digest('hex'),
  }
}

/** Brotli-decode a stored object's chunks. A decoding error ends the stream with it. */
function brotliDecode(
  stored: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  return pipeline(Readable.from(stored), createBrotliDecompress(), (): void => {
    // The reader sees the error: the decoder's stream is destroyed with it.
  })
}

/** The ports for a `.tar.br` stored object (`brotli: true`) or a plain tarball. */
function nodeStreamPorts(
  options: Readonly<{ brotli: boolean }>,
): StreamValidationPorts {
  return options.brotli
    ? { hash: sha256, hasher, decode: brotliDecode }
    : { hash: sha256, hasher }
}

export { nodeStreamPorts }
