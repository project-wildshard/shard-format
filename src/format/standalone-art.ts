import { ENGINE_ART } from './engine-art.ts'
import { issueError } from './issue-codes.ts'

import type { CookMount } from './cook-data.ts'

const START = 0
const PATH_ONLY = 1

/** Query and fragment suffixes identify the same published asset path. */
function assetPath(url: string): string {
  return url.split(/[?#]/u, PATH_ONLY)[START] ?? ''
}

function mentionedAssets(values: Iterable<unknown>): Set<string> {
  const found = new Set<string>()
  const pending = [...values]
  while (pending.length > START) {
    const value = pending.pop()
    if (typeof value === 'string' && value.startsWith('/assets/')) {
      found.add(assetPath(value))
    } else if (typeof value === 'object' && value !== null) {
      for (const item of Object.values(value)) {
        pending.push(item)
      }
    }
  }
  return found
}

function covered(url: string, mounts: ReadonlySet<string>): boolean {
  if (!url.endsWith('/')) {
    return mounts.has(url) || ENGINE_ART.has(url)
  }
  for (const path of mounts) {
    if (path.startsWith(url)) {
      return true
    }
  }
  return false
}

/** Both the folder packer and the streaming API validate the same mount table. */
function assertStandaloneArt(
  values: Iterable<unknown>,
  mounts: readonly Readonly<CookMount>[],
): void {
  const paths = new Set(
    mounts.map((row: Readonly<CookMount>): string => row.url),
  )
  for (const url of mentionedAssets(values)) {
    if (!covered(url, paths)) {
      throw issueError(
        'cook-invalid',
        `Missing shardfile asset ${url}: include it in the shardfile's mounts`,
      )
    }
  }
}

/** Art and authored programs are scoped to the owning shard. Discovery is product metadata. */
function assertShardMountUrls(
  slug: string,
  mounts: readonly Readonly<CookMount>[],
): void {
  const prefix = `/assets/${slug}/`
  const program = `/programs/${slug}.json`
  const discovery = `/shardfiles/${slug}/discovery.json`
  const images = `/shardfiles/${slug}/blobs/image/`
  for (const { url, hash } of mounts) {
    const image =
      url.startsWith(images) &&
      ['.jpg', '.png', '.webp'].some(
        (suffix): boolean => url === `${images}${hash}${suffix}`,
      )
    if (
      !url.startsWith(prefix) &&
      url !== program &&
      url !== discovery &&
      !image
    ) {
      throw issueError(
        'cook-invalid',
        `Shard ${slug} mount ${url} must use ${prefix} or ${program}`,
      )
    }
  }
}

function readDiscoveryArt(bytes: Readonly<Uint8Array>): unknown {
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

export { assertShardMountUrls, assertStandaloneArt, readDiscoveryArt }
