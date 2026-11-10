import {
  array,
  boolean,
  finite,
  integer,
  literal,
  minValue,
  null_,
  number,
  parse,
  pipe,
  string,
  tuple,
  union,
} from 'valibot'

const ZERO = 0
const ONE = 1
const TWO = 2
const MAX_EXPANDED = 100_000_000
const MAX_NODES = 500_000
const encoder = new TextEncoder()
const natural = pipe(number(), integer(), minValue(ZERO))
const scalar = union([null_(), boolean(), pipe(number(), finite()), string()])
const referencePair = tuple([natural, natural])
const NodeSchema = union([
  tuple([literal(ZERO), scalar]),
  tuple([literal(ONE), array(natural)]),
  tuple([literal(TWO), array(referencePair)]),
])
type Scalar = null | boolean | number | string
type Node =
  | readonly [typeof ZERO, Scalar]
  | readonly [typeof ONE, readonly number[]]
  | readonly [typeof TWO, readonly (readonly [number, number])[]]
function nodeOf(value: unknown): ReturnType<typeof parse<typeof NodeSchema>> {
  return parse(NodeSchema, value)
}
function bytes(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value)}\n`)
}
class Dictionary {
  public readonly nodes: Node[] = []
  private readonly keys = new Map<string, number>()
  private node(value: unknown): Node {
    if (Array.isArray(value)) {
      return [ONE, value.map((item: unknown): number => this.put(item))]
    }
    if (value !== null && typeof value === 'object') {
      return [
        TWO,
        Object.entries(value).map(
          ([key, item]: readonly [string, unknown]): readonly [
            number,
            number,
          ] => [this.put(key), this.put(item)],
        ),
      ]
    }
    return [ZERO, parse(scalar, value)]
  }
  public put(value: unknown): number {
    return this.retain(this.node(value))
  }
  private retain(node: Node): number {
    const key = JSON.stringify(node)
    const previous = this.keys.get(key)
    if (previous !== undefined) {
      return previous
    }
    const index = this.nodes.length
    if (index >= MAX_NODES) {
      throw new Error('Capture graph exceeds its node budget')
    }
    this.nodes.push(node)
    this.keys.set(key, index)
    return index
  }
}
interface Measure {
  readonly size: number
  readonly depth: number
}
const MAX_DEPTH = 64
function checked(size: number, depth: number): Measure {
  if (size > MAX_EXPANDED || depth > MAX_DEPTH) {
    throw new Error('Capture graph exceeds its expansion budget')
  }
  return { size, depth }
}
function readRef<Value>(values: readonly Value[], id: number): Value {
  const value = values[id]
  if (value === undefined) {
    throw new Error('Capture graph has a forward or missing reference')
  }
  return value
}
function arraySize(ids: readonly number[], sizes: readonly Measure[]): Measure {
  let size = TWO + Math.max(ZERO, ids.length - ONE)
  let depth = ONE
  for (const id of ids) {
    const entry = readRef(sizes, id)
    size += entry.size
    depth = Math.max(depth, entry.depth + ONE)
  }
  return checked(size, depth)
}
function objectKey(nodes: readonly Node[], id: number): string {
  const key = readRef(nodes, id)
  if (key[ZERO] !== ZERO || typeof key[ONE] !== 'string') {
    throw new Error('Capture graph has an invalid object key')
  }
  return key[ONE]
}
function objectSize(
  ids: readonly (readonly [number, number])[],
  sizes: readonly Measure[],
  nodes: readonly Node[],
): Measure {
  const keys = new Set<string>(),
    measure = { size: TWO + Math.max(ZERO, ids.length - ONE), depth: ONE }
  for (const [keyId, valueId] of ids) {
    const keySize = readRef(sizes, keyId)
    const item = readRef(sizes, valueId)
    const key = objectKey(nodes, keyId)
    if (keys.has(key)) {
      throw new Error('Capture graph has a repeated object key')
    }
    keys.add(key)
    Object.assign(measure, {
      size: measure.size + keySize.size + ONE + item.size,
      depth: Math.max(measure.depth, item.depth + ONE),
    })
  }
  return checked(measure.size, measure.depth)
}
function validateGraph(nodes: readonly Node[], root: number): void {
  const sizes: Measure[] = []
  for (const node of nodes) {
    if (node[ZERO] === ZERO) {
      sizes.push(checked(bytes(node[ONE]).length - ONE, ZERO))
    } else if (node[ZERO] === ONE) {
      sizes.push(arraySize(node[ONE], sizes))
    } else {
      sizes.push(objectSize(node[ONE], sizes, nodes))
    }
  }
  readRef(sizes, root)
}
function objectValue(
  ids: readonly (readonly [number, number])[],
  values: readonly unknown[],
  nodes: readonly Node[],
): unknown {
  const object: Record<string, unknown> = {}
  for (const [keyId, valueId] of ids) {
    Object.defineProperty(object, objectKey(nodes, keyId), {
      value: readRef(values, valueId),
      enumerable: true,
    })
  }
  return object
}
/** Validate every reference and expansion bound before constructing any output container. */
function expand(nodes: readonly Node[], root: number): unknown {
  validateGraph(nodes, root)
  const values: unknown[] = []
  for (const node of nodes) {
    if (node[ZERO] === ZERO) {
      values.push(node[ONE])
    } else if (node[ZERO] === ONE) {
      values.push(node[ONE].map((id: number): unknown => readRef(values, id)))
    } else {
      values.push(objectValue(node[ONE], values, nodes))
    }
  }
  return readRef(values, root)
}
export { Dictionary, expand, nodeOf, MAX_EXPANDED, MAX_NODES, type Node }
