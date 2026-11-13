// SERVER-PARITY SS12 (engine 1e99d663, meta docs/plans/SERVER-PARITY-PLAN.md): the server drops `view` rows from
// `actors/return-scripts` before it lends return modules (`serverReturnRows`), so a program the server runs that points
// at one fails at install (`Missing admitted raw return module loan`). Format cannot tell which named files the server
// reads, so a view return row may run only from a page-only host's program path (`script-sides.ts`). The JSON row
// readers here serve both files.

/** The product's named JSON files: a reader by name (`undefined` when absent or not JSON) and every name. */
interface NamedFiles {
  readonly read: (name: string) => unknown
  readonly names: readonly string[]
}

/** A program found in a product document: where it is, as `<document> (<dot path>)`, and its script row. */
interface FoundProgram {
  readonly at: string
  readonly script: unknown
}

const RETURN_SCRIPTS = 'actors/return-scripts'

/** An own property of a plain object, or `undefined`. */
function propOf(value: unknown, key: string): unknown {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !Object.hasOwn(value, key)
  ) {
    return undefined
  }
  const found: unknown = Reflect.get(value, key)
  return found
}

/** A string property, or `undefined`. */
function textOf(value: unknown, key: string): string | undefined {
  const text = propOf(value, key)
  return typeof text === 'string' ? text : undefined
}

/** An array, or an empty list. */
function rowsOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

/** Every return program (an object whose `script` names a `module`) under `node`, with its dot path from `keys`. */
function programsIn(
  document: string,
  node: unknown,
  keys: readonly string[] = [],
): FoundProgram[] {
  if (typeof node !== 'object' || node === null) {
    return []
  }
  const children: [string, unknown][] = Array.isArray(node)
    ? node.map((item: unknown, at: number): [string, unknown] => [
        String(at),
        item,
      ])
    : Object.keys(node).map((key: string): [string, unknown] => [
        key,
        propOf(node, key),
      ])
  const script = propOf(node, 'script')
  const own: FoundProgram[] =
    textOf(script, 'module') === undefined
      ? []
      : [{ at: `${document} (${keys.join('.')})`, script }]
  return [
    ...own,
    ...children.flatMap(
      ([key, child]: readonly [string, unknown]): FoundProgram[] =>
        programsIn(document, child, [...keys, key]),
    ),
  ]
}

/** The only places a view return row may run: each page-only host's program (its script path less `script`), as
 *  `<file> (<dot path>)`. */
function pageOnlyPrograms(
  sections: ReadonlyMap<string, unknown>,
  hosts: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const features = rowsOf(propOf(sections.get('client/plan'), 'features'))
  return new Set(
    features.flatMap((feature: unknown): string[] => {
      const host = hosts.get(textOf(feature, 'kind') ?? '')
      const file = textOf(feature, 'file')
      const program = host?.join('.').replace(/(?:^|\.)script$/u, '')
      return program === undefined || file === undefined
        ? []
        : [`${file} (${program})`]
    }),
  )
}

/** Programs that run a `view` return row anywhere but a page-only host, as refusal lines. A program runs the row whose
 *  module it names: the engine lends return modules by hash, and admission refuses a module that a `sim` and a `view`
 *  row share (`decisionModuleContracts`). A copy with inline bytes needs no loan but is refused too: the row's side says
 *  only the page runs it.
 *  Only a product with a view return row is walked: every section but the return rows, and every named JSON file. */
function viewReturnRefusals(
  sections: ReadonlyMap<string, unknown>,
  files: NamedFiles,
  hosts: ReadonlyMap<string, readonly string[]>,
): string[] {
  const views = rowsOf(sections.get(RETURN_SCRIPTS)).filter(
    (row: unknown): boolean => textOf(row, 'side') === 'view',
  )
  const [first] = views
  if (first === undefined) {
    return []
  }
  const allowed = pageOnlyPrograms(sections, hosts)
  const documents: [string, unknown][] = [
    ...[...sections].filter(
      ([name]: readonly [string, unknown]): boolean => name !== RETURN_SCRIPTS,
    ),
    ...files.names.map((name: string): [string, unknown] => [
      name,
      files.read(name),
    ]),
  ]
  const found = documents.flatMap(
    ([document, value]: readonly [string, unknown]): FoundProgram[] =>
      programsIn(document, value),
  )
  return found.flatMap(({ at, script }: FoundProgram): string[] => {
    const view = views.find(
      (row: unknown): boolean =>
        textOf(row, 'module') === textOf(script, 'module'),
    )
    return view === undefined || allowed.has(at)
      ? []
      : [
          `view script ${textOf(view, 'id') ?? '(no id)'} is a program in ${at}, which the server may run; only a page-only host runs a view row`,
        ]
  })
}

export { propOf, rowsOf, textOf, viewReturnRefusals }
export type { NamedFiles }
