// SHARD-AUTHORING SA20: named hosts for a headless assembly's `$ref`s.
// A shard's data never names an engine module path (J158). Where an
// assembly operand reads an engine function, it names a host instead:
// `{ "$ref": ["host", "proveTerrainEntries"] }`. The host list is closed
// and lives here, so a shard and the engine agree on it through the format.

/** Every host an assembly `$ref` may name, with what it is. */
const ASSEMBLY_HOSTS: Readonly<Record<string, string>> = Object.freeze({
  clamp: 'clamp(value, min, max)',
  proveTerrainEntries:
    "the terrain entry walk: (physics, entryways, heightAt, spec) => the shard's proven entries",
})

/** The head of a host `$ref`: `["host", <name>, ...path]`. */
const ASSEMBLY_HOST_HEAD = 'host'

const MODULE_PATH = /^@|\//u

function refIssue(ref: readonly unknown[], where: string): string | undefined {
  const [head, name] = ref
  if (typeof head !== 'string') {
    return undefined
  }
  if (MODULE_PATH.test(head)) {
    return `${where}: $ref names the module path ${head}; name a host instead: ["${ASSEMBLY_HOST_HEAD}", <name>]`
  }
  if (
    head === ASSEMBLY_HOST_HEAD &&
    (typeof name !== 'string' || !Object.hasOwn(ASSEMBLY_HOSTS, name))
  ) {
    return `${where}: $ref names the unknown host ${String(name)}; hosts: ${Object.keys(ASSEMBLY_HOSTS).join(', ')}`
  }
  return undefined
}

type Child = readonly [here: string, key: string, item: unknown]

function childrenOf(value: unknown, where: string): readonly Child[] {
  if (Array.isArray(value)) {
    return value.map((item: unknown, index: number): Child => [
      `${where}[${String(index)}]`,
      String(index),
      item,
    ])
  }
  if (value === null || typeof value !== 'object') {
    return []
  }
  return Object.entries(value).map(
    ([key, item]: readonly [string, unknown]): Child => [
      `${where}.${key}`,
      key,
      item,
    ],
  )
}

function collect(value: unknown, where: string): string[] {
  const issues: string[] = []
  for (const [here, key, item] of childrenOf(value, where)) {
    const issue =
      key === '$ref' && Array.isArray(item) ? refIssue(item, here) : undefined
    if (issue !== undefined) {
      issues.push(issue)
    }
    issues.push(...collect(item, here))
  }
  return issues
}

/** Every `$ref` in an assembly document that names a module path or an
 *  unknown host, as `<json path>: <fix>` lines; none means it passes. */
function assemblyRefIssues(document: unknown): string[] {
  return collect(document, '$')
}

export { ASSEMBLY_HOST_HEAD, ASSEMBLY_HOSTS, assemblyRefIssues }
