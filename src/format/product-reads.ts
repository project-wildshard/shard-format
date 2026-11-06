// How a validation holds a product's files. Format's checks want `assets` by
// hash long after a file's own check, so a host that can't hold a shard in
// memory asks for `readThrough`: each `get` reads the file again.

type ReadFile = (path: string, maxBytes: number) => Uint8Array
type Pack = Readonly<{
  path: string
  bytes: number
  hash: string
  entries: readonly Readonly<{ hash: string; offset: number; bytes: number }>[]
}>
interface Listed {
  readonly hash: string
  readonly path: string
}
interface Members {
  readonly sections: readonly Listed[]
  readonly schemas: readonly Listed[]
  readonly files: readonly Listed[]
}
type Assets = ReadonlyMap<string, Uint8Array>

interface AssetRow {
  readonly path: string
  readonly hash: string
  readonly compressed: number
  readonly commons?: boolean
}

interface AssetStore {
  readonly assets: Assets
  readonly keep: (
    row: AssetRow,
    bytes: Readonly<Uint8Array>,
    shared: boolean,
  ) => void
}

interface PackPorts {
  readonly readFile: ReadFile
  readonly readListed: (
    row: Readonly<{ path: string; hash: string; bytes: number }>,
  ) => Uint8Array
  readonly verify: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a port's own type
    bytes: Uint8Array,
    expected: string,
    whole: boolean,
  ) => boolean
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a port's own type
  readonly hash: (bytes: Uint8Array) => string
}

/** Admitted bytes read again on each `get`. */
function readThroughAssets(
  read: ReadFile,
  places: ReadonlyMap<string, AssetRow>,
): Assets {
  const get = (key: string): Uint8Array | undefined => {
    const place = places.get(key)
    return place === undefined ? undefined : read(place.path, place.compressed)
  }
  const all = (): Map<string, Uint8Array> =>
    new Map(
      [...places.keys()].map((key: string): [string, Uint8Array] => [
        key,
        get(key) ?? new Uint8Array(),
      ]),
    )
  const assets: Assets = {
    get,
    has: (key: string): boolean => places.has(key),
    size: places.size,
    keys: (): MapIterator<string> => places.keys(),
    values: (): MapIterator<Uint8Array> => all().values(),
    entries: (): MapIterator<[string, Uint8Array]> => all().entries(),
    forEach: (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a port's own type
      visit: (bytes: Uint8Array, key: string, map: Assets) => void,
    ): void => {
      for (const [key, bytes] of all()) {
        visit(bytes, key, assets)
      }
    },
    [Symbol.iterator]: (): MapIterator<[string, Uint8Array]> => all().entries(),
  }
  return assets
}

/** Where a validation keeps files, by each file's hash and `commons:` key. */
function assetStore(read: ReadFile, readThrough: boolean): AssetStore {
  const held = new Map<string, Uint8Array>()
  const places = new Map<string, AssetRow>()
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a port's own type
  const keepOne = (key: string, row: AssetRow, bytes: Uint8Array): void => {
    if (readThrough) {
      places.set(key, row)
    } else {
      held.set(key, bytes)
    }
  }
  return {
    assets: readThrough ? readThroughAssets(read, places) : held,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a port's own type
    keep: (row: AssetRow, bytes: Uint8Array, shared: boolean): void => {
      keepOne(
        `${row.commons === true ? 'commons:' : ''}${row.hash}`,
        row,
        bytes,
      )
      if (shared) {
        keepOne(`commons:${row.hash}`, row, bytes)
      }
    },
  }
}

/** A pack again, byte for byte, from its members. Every member keeps its own
 *  path, so a tarball may leave packs out (C0); whoever serves a product
 *  rebuilds them with this. `read` is by a listed path. */
function packFromMembers(
  pack: Pack,
  index: Members,
  read: ReadFile,
): Uint8Array {
  const rows = [...index.sections, ...index.schemas, ...index.files]
  const paths = new Map(
    rows.map((row: Listed): [string, string] => [row.hash, row.path]),
  )
  const bytes = new Uint8Array(pack.bytes)
  for (const entry of pack.entries) {
    const path = paths.get(entry.hash)
    if (path === undefined) {
      throw new Error(`Pack member outside its listed inventory: ${pack.path}`)
    }
    bytes.set(read(path, entry.bytes), entry.offset)
  }
  return bytes
}

/** A carried pack's members match its bytes. A tarball may leave a pack out,
 *  since its members ship anyway; left out, it must still come out of them. */
function checkPacks(
  index: Members & Readonly<{ packs?: readonly Pack[] }>,
  present: ReadonlySet<string>,
  ports: PackPorts,
): void {
  for (const pack of index.packs ?? []) {
    if (present.has(pack.path)) {
      const bytes = ports.readListed(pack)
      for (const entry of pack.entries) {
        const member = bytes.subarray(entry.offset, entry.offset + entry.bytes)
        if (!ports.verify(member, entry.hash, false)) {
          throw new Error(`Pack member differs: ${pack.path}`)
        }
      }
    } else if (
      ports.hash(packFromMembers(pack, index, ports.readFile)) !== pack.hash
    ) {
      throw new Error(`Pack differs from its members: ${pack.path}`)
    }
  }
}

export { assetStore, checkPacks, packFromMembers }
