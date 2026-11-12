// oxlint-disable eslint/max-params, eslint/max-statements, eslint/max-lines-per-function, typescript/prefer-readonly-parameter-types -- the old validator's steps in its order, over reads that share state; the state is only read but for the held maps
// `checkPacks` for the streaming validator (API-CLOUDFLARE AC6a2). A carried
// pack's members are checked against its slices as it streams past. A pack
// the tarball leaves out is rebuilt by hashing its members in entry order
// (`parseOutputIndex` holds them contiguous, at their listed sizes, from 0 to
// the pack's size). The tarball is sorted by path, not by pack order, so a
// member that streams early waits, held, until the members before it pass.
// The packs are split into groups whose held bytes stay under a cap, and
// each group takes its own read of the stored object.

import type { OutputIndex } from './outputIndex.ts'
import type { StreamHasher } from './product-stream-tar.ts'

type Pack = NonNullable<OutputIndex['packs']>[number]

/** The most member bytes one read holds for its left-out packs. */
const PACK_HOLD_CAP = 16_000_000
const NONE = 0
const NEXT = 1

/** A left-out pack being rebuilt: the next entry to hash, and the ones that came early. */
interface PackRun {
  readonly pack: Pack
  readonly paths: readonly string[]
  readonly hasher: StreamHasher
  readonly early: Map<number, Readonly<Uint8Array>>
  cursor: number
}

/** What one read found for its packs: by pack path, the refusal or undefined. */
type PackVerdicts = Map<string, string | undefined>

/** Each pack member's listed path: `packFromMembers`' lookup, the last listed row of a hash winning. */
function memberPaths(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
): ReadonlyMap<string, string> {
  return new Map(
    [...index.sections, ...index.schemas, ...index.files].map(
      (row: Readonly<{ hash: string; path: string }>): [string, string] => [
        row.hash,
        row.path,
      ],
    ),
  )
}

/** A pack's entry paths, in entry order. */
function entryPaths(
  pack: Readonly<Pack>,
  paths: ReadonlyMap<string, string>,
): string[] {
  return pack.entries.map(
    (entry: Readonly<{ hash: string }>): string => paths.get(entry.hash) ?? '',
  )
}

/** A left-out pack in `heldPeak`: sizes only. */
interface SizedRun {
  readonly paths: readonly string[]
  readonly early: Set<number>
  cursor: number
}

/** Which entries of which pack wait on each path. */
function waitsByPath<Run extends Readonly<{ paths: readonly string[] }>>(
  runs: readonly Run[],
): Map<string, { run: Run; at: number }[]> {
  const waits = new Map<string, { run: Run; at: number }[]>()
  for (const run of runs) {
    for (const [at, path] of run.paths.entries()) {
      waits.set(path, [...(waits.get(path) ?? []), { run, at }])
    }
  }
  return waits
}

/** The most bytes a group of left-out packs holds in one read, members arriving in `order`: `packPass`, by size. */
function heldPeak(
  group: readonly (readonly string[])[],
  order: readonly string[],
  sizes: ReadonlyMap<string, number>,
): number {
  const runs = group.map((paths: readonly string[]): SizedRun => ({
    paths,
    cursor: NONE,
    early: new Set<number>(),
  }))
  const waits = waitsByPath(runs)
  let held = NONE
  let peak = NONE
  for (const path of order) {
    for (const { run, at } of waits.get(path) ?? []) {
      run.early.add(at)
      held += sizes.get(path) ?? NONE
      peak = Math.max(peak, held)
      while (run.early.delete(run.cursor)) {
        held -= sizes.get(run.paths[run.cursor] ?? '') ?? NONE
        run.cursor += NEXT
      }
    }
  }
  return peak
}

/** The left-out packs in read groups, each under `PACK_HOLD_CAP` held (a pack alone over it still gets a group). */
function packGroups(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  present: ReadonlySet<string>,
  order: readonly string[],
  sizes: ReadonlyMap<string, number>,
): Pack[][] {
  const paths = memberPaths(index)
  const groups: Pack[][] = []
  let group: Pack[] = []
  for (const pack of index.packs ?? []) {
    if (!present.has(pack.path)) {
      const next = [...group, pack]
      const peak = heldPeak(
        next.map((row: Readonly<Pack>): string[] => entryPaths(row, paths)),
        order,
        sizes,
      )
      if (peak > PACK_HOLD_CAP && group.length > NONE) {
        groups.push(group)
        group = [pack]
      } else {
        group = next
      }
      if (
        group.length === NEXT &&
        heldPeak([entryPaths(pack, paths)], order, sizes) > PACK_HOLD_CAP
      ) {
        throw new Error(`stream: a pack over the streaming cap: ${pack.path}`)
      }
    }
  }
  return group.length > NONE ? [...groups, group] : groups
}

/** One read's pack checks: carried packs against their slices, a group of left-out packs rebuilt. */
interface PackPass {
  /** Paths whose bytes this read needs. */
  readonly wants: ReadonlySet<string>
  /** One member's bytes, in tarball order. */
  readonly member: (path: string, bytes: Readonly<Uint8Array>) => void
  /** The bytes held now for left-out packs. */
  readonly held: () => number
  /** Each pack's refusal, or undefined, once the read ends. */
  readonly finish: () => PackVerdicts
}

function packPass(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  packs: Readonly<{ carried: readonly Pack[]; group: readonly Pack[] }>,
  ports: Readonly<{
    hash: (bytes: Readonly<Uint8Array>) => string
    hasher: () => StreamHasher
  }>,
): PackPass {
  const paths = memberPaths(index)
  const verdicts: PackVerdicts = new Map()
  const { carried, group } = packs
  const carriedByPath = new Map(
    carried.map((pack: Readonly<Pack>): [string, Pack] => [pack.path, pack]),
  )
  const runs: PackRun[] = group.map((pack: Readonly<Pack>): PackRun => ({
    pack,
    paths: entryPaths(pack, paths),
    hasher: ports.hasher(),
    early: new Map(),
    cursor: NONE,
  }))
  const waits = waitsByPath(runs)
  let held = NONE
  const advance = (run: PackRun): void => {
    for (;;) {
      const bytes = run.early.get(run.cursor)
      if (bytes === undefined) {
        return
      }
      run.early.delete(run.cursor)
      held -= bytes.length
      run.hasher.update(bytes)
      run.cursor += NEXT
    }
  }
  const member = (path: string, bytes: Readonly<Uint8Array>): void => {
    const pack = carriedByPath.get(path)
    if (pack !== undefined) {
      const differs = pack.entries.some(
        (
          entry: Readonly<{ hash: string; offset: number; bytes: number }>,
        ): boolean =>
          ports.hash(
            bytes.subarray(entry.offset, entry.offset + entry.bytes),
          ) !== entry.hash,
      )
      verdicts.set(
        pack.path,
        differs ? `Pack member differs: ${pack.path}` : undefined,
      )
    }
    for (const { run, at } of waits.get(path) ?? []) {
      run.early.set(at, bytes)
      held += bytes.length
      advance(run)
    }
  }
  const finish = (): PackVerdicts => {
    for (const run of runs) {
      if (run.cursor < run.paths.length) {
        throw new Error(`missing file: ${run.paths[run.cursor] ?? ''}`)
      }
      verdicts.set(
        run.pack.path,
        run.hasher.digest() === run.pack.hash
          ? undefined
          : `Pack differs from its members: ${run.pack.path}`,
      )
    }
    return verdicts
  }
  return {
    wants: new Set([...carriedByPath.keys(), ...waits.keys()]),
    member,
    held: (): number => held,
    finish,
  }
}

export type { PackPass, PackVerdicts }
export {
  PACK_HOLD_CAP,
  heldPeak,
  memberPaths,
  entryPaths,
  packGroups,
  packPass,
}
