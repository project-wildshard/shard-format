// SERVER-PARITY SS7 (meta docs/plans/SERVER-PARITY-PLAN.md): a script's declared side must match where it is hosted. A v1
// row says `sim` or `view` (`decisionScripts.ts`), and a `view` row writes no gameplay (a row rule there). Against the
// whole product: a `sim` row that a page-only feature runs has no server half there, and a `view` row in `sim/scripts`
// would run on the server's decision host. v1 sides and v2 lanes map onto SS2's side words (`feature-sides.ts`).
// SS12 (`script-view-returns.ts`): a program that runs a `view` return row is refused anywhere but a page-only host.
// oxlint-disable typescript/prefer-readonly-parameter-types -- OutputIndex and the byte arrays are only read
import { CLIENT_FEATURE_SIDES } from './feature-sides.ts'
import { parseNamedJson } from './json.ts'
import { splitGrandfathered } from './script-side-grandfather.ts'
import {
  propOf,
  rowsOf,
  textOf,
  viewReturnRefusals,
} from './script-view-returns.ts'

import type { FeatureSide } from './feature-sides.ts'
import type { OutputIndex } from './outputIndex.ts'
import type { ScriptSideProduct } from './script-side-grandfather.ts'
import type { NamedFiles } from './script-view-returns.ts'
import type { ScriptV1CommandName } from './scriptAbiV1.ts'
import type { V2Lane } from './scriptFuelV2.ts'

/** A v1 row's declared side. */
const SCRIPT_V1_SIDES = ['sim', 'view'] as const

type ScriptV1Side = (typeof SCRIPT_V1_SIDES)[number]

/** Each v1 side in SS2's words: a `sim` row's gameplay is the server's, and the page may also project it (return
 *  programs run on both sides); a `view` row is page only. */
const SCRIPT_V1_FEATURE_SIDES: Readonly<Record<ScriptV1Side, FeatureSide>> =
  Object.freeze({ sim: 'both', view: 'view' })

/** Each v2 lane in SS2's words: `sim` runs only in the server's owned batch; `project` is a stateless return program
 *  both sides run, the server owning its gameplay; `view` runs on the page only. */
const SCRIPT_V2_LANE_SIDES: Readonly<Record<V2Lane, FeatureSide>> =
  Object.freeze({ project: 'both', sim: 'server', view: 'view' })

/** The only commands a `view` row may emit: a timer, a cue and a projection channel. Every other v1 command writes
 *  gameplay: moves, strikes, fields, spawns, flags, signals, grants, rewards, impulses, encounters, weather, bodies. */
const SCRIPT_V1_VIEW_COMMANDS: ReadonlySet<ScriptV1CommandName> = new Set([
  'channel',
  'cue',
  'timer',
])

const VIEW_WRITES_GAMEPLAY =
  'view script writes no gameplay (only timer, cue and channel commands)'

/** Whether a `view` row may emit this command. */
function isViewCommand(command: ScriptV1CommandName): boolean {
  return SCRIPT_V1_VIEW_COMMANDS.has(command)
}

/**
 * The `view` feature kinds whose named file (`file`) carries a return program that only the page runs, with the path
 * of the script row inside that file. A `sim` row run here is page-only gameplay: Pine's `pine.life` sets
 * `secret:log` from engine's client `pageLife` alone (SERVER-PARITY inventory row 3). SS5 runs it on the server too,
 * and the live product passes on `SCRIPT_SIDE_GRANDFATHER` until SS11.
 *
 * `practice.course` has the same shape (a `sim` row only the page runs) but is cosmetic; it joins this table once
 * Nalati and Nine Dragon declare their `practice.course` rows `view`.
 */
const PAGE_ONLY_PROGRAM_HOSTS: ReadonlyMap<string, readonly string[]> = new Map(
  [['page.life', ['program', 'script']]],
)

/** Reads one named JSON file of the product by its name: `undefined` when it is absent or not JSON. */
type NamedJson = (name: string) => unknown

/** The product files a validator reads before its inventory pass, and its hash check (`whole` as in
 *  `ProductValidationPorts.verify`). */
interface UncheckedFiles {
  readonly read: (path: string, bytes: number) => Uint8Array | undefined
  readonly paths: () => Iterable<string>
  readonly verify: (
    bytes: Uint8Array,
    expected: string,
    whole: boolean,
  ) => boolean
}

/** The value at `keys` under `value`, or `undefined`. */
function pathOf(value: unknown, keys: readonly string[]): unknown {
  let found = value
  for (const key of keys) {
    found = propOf(found, key)
  }
  return found
}

/** Whether two JSON values are equal by value, whatever their key order. */
function sameJson(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item: unknown, at: number): boolean =>
        sameJson(item, right[at]),
      )
    )
  }
  if (typeof left !== 'object' || left === null) {
    return left === right
  }
  const keys = Object.keys(left)
  return (
    typeof right === 'object' &&
    right !== null &&
    Object.keys(right).length === keys.length &&
    keys.every((key: string): boolean =>
      sameJson(propOf(left, key), propOf(right, key)),
    )
  )
}

/** A page-only host feature's kind, file and the script row inside that file, or `undefined`. */
function hostedScript(
  feature: unknown,
  named: NamedJson,
): { kind: string; file: string; script: unknown } | undefined {
  const kind = textOf(feature, 'kind') ?? ''
  const host = PAGE_ONLY_PROGRAM_HOSTS.get(kind)
  const file = textOf(feature, 'file')
  const script =
    host === undefined || file === undefined
      ? undefined
      : pathOf(named(file), host)
  return script === undefined || file === undefined
    ? undefined
    : { file, kind, script }
}

/** The script a page-only host feature runs, as refusal lines: a copy that is not its admitted `actors/return-scripts`
 *  row (so its side and rules are the admitted row's), or a `sim` row, which no server host runs there. */
function pageOnlyRefusal(
  feature: unknown,
  named: NamedJson,
  returns: readonly unknown[],
): string[] {
  const hosted = hostedScript(feature, named)
  if (hosted === undefined) {
    return []
  }
  const { file, kind, script } = hosted
  const id = textOf(script, 'id') ?? '(no id)'
  const admitted = returns.find(
    (row: unknown): boolean => textOf(row, 'id') === id,
  )
  if (admitted === undefined || !sameJson(admitted, script)) {
    return [
      `${kind} program ${id} (${file}) is not its actors/return-scripts row`,
    ]
  }
  return textOf(admitted, 'side') === 'sim'
    ? [
        `sim script ${id} runs in page-only feature ${kind} (${file}), which no server host runs`,
      ]
    : []
}

/** A `view` row in `sim/scripts`, as a refusal line, or nothing. */
function serverViewRefusal(row: unknown): string[] {
  if (textOf(row, 'side') !== 'view') {
    return []
  }
  const id = textOf(row, 'id') ?? '(no id)'
  return [
    `view script ${id} is in sim/scripts, which only the server's decision host runs`,
  ]
}

/** Every side refusal in a product: its sections, a reader of its named JSON files and their names (SS12 reads each). */
function scriptSideRefusals(
  sections: ReadonlyMap<string, unknown>,
  named: NamedJson,
  names: readonly string[] = [],
): string[] {
  const features = rowsOf(propOf(sections.get('client/plan'), 'features'))
  const returns = rowsOf(sections.get('actors/return-scripts'))
  const hosted = features.flatMap((feature: unknown): string[] =>
    pageOnlyRefusal(feature, named, returns),
  )
  const decisions = rowsOf(sections.get('sim/scripts')).flatMap(
    (row: unknown): string[] => serverViewRefusal(row),
  )
  const views = viewReturnRefusals(
    sections,
    { names, read: named },
    PAGE_ONLY_PROGRAM_HOSTS,
  )
  return [...new Set([...hosted, ...decisions, ...views])]
}

/** The product's named JSON files, by the index: their names, and a reader that never throws and reads only bytes that
 *  match the index (a missing, resized, changed or malformed file is `undefined` here, and the inventory or its schema
 *  refuses it later). */
function namedJsonFiles(index: OutputIndex, files: UncheckedFiles): NamedFiles {
  const present = new Set(files.paths())
  const names = index.files.flatMap(
    (file: OutputIndex['files'][number]): string[] =>
      file.kind === 'json' && file.name !== undefined ? [file.name] : [],
  )
  const read = (name: string): unknown => {
    const file = index.files.find(
      (entry: OutputIndex['files'][number]): boolean =>
        entry.kind === 'json' && entry.name === name,
    )
    if (file === undefined || !present.has(file.path)) {
      return undefined
    }
    try {
      const bytes = files.read(file.path, file.compressed)
      return bytes?.length === file.compressed &&
        files.verify(bytes, file.hash, false)
        ? parseNamedJson(bytes)
        : undefined
    } catch {
      return undefined
    }
  }
  return { names, read }
}

/** A product's side refusals, split: lines a grandfather entry covers become warnings, the rest stay refusals. */
function scriptSideVerdict(
  sections: ReadonlyMap<string, unknown>,
  files: NamedFiles,
  product: ScriptSideProduct,
): { refused: string[]; warnings: string[] } {
  return splitGrandfathered(
    scriptSideRefusals(sections, files.read, files.names),
    product,
  )
}

/** Refuse a product whose scripts run on the wrong side, and return its grandfathered lines as warnings. Both
 *  validators call it once their sections are read. */
function assertScriptSides(
  sections: ReadonlyMap<string, unknown>,
  index: OutputIndex,
  files: UncheckedFiles,
): string[] {
  const { refused, warnings } = scriptSideVerdict(
    sections,
    namedJsonFiles(index, files),
    { slug: index.identity.slug, sourceHash: index.build.sourceHash },
  )
  const [first, ...rest] = refused
  if (first !== undefined) {
    throw new Error(`Script side refused: ${[first, ...rest].join('; ')}`)
  }
  return warnings
}

/** The side SS2's table gives each page-only host (a test pins them all to `view`). */
function pageOnlyHostSides(): Map<string, FeatureSide | undefined> {
  const sides = new Map<string, FeatureSide>(
    Object.entries(CLIENT_FEATURE_SIDES).map(
      ([kind, entry]): [string, FeatureSide] => [kind, entry.side],
    ),
  )
  return new Map(
    [...PAGE_ONLY_PROGRAM_HOSTS.keys()].map(
      (kind: string): [string, FeatureSide | undefined] => [
        kind,
        sides.get(kind),
      ],
    ),
  )
}

export {
  PAGE_ONLY_PROGRAM_HOSTS,
  SCRIPT_V1_FEATURE_SIDES,
  SCRIPT_V1_SIDES,
  SCRIPT_V1_VIEW_COMMANDS,
  SCRIPT_V2_LANE_SIDES,
  VIEW_WRITES_GAMEPLAY,
  assertScriptSides,
  isViewCommand,
  pageOnlyHostSides,
  scriptSideRefusals,
  scriptSideVerdict,
}
export type { NamedJson, ScriptV1Side, UncheckedFiles }
