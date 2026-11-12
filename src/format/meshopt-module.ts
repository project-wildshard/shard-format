// The meshopt decoder over an instance the host made (API-CLOUDFLARE AC6a).
// `meshoptimizer/decoder` compiles its WebAssembly from bytes when it loads,
// which a Worker refuses; a Worker imports `meshopt-decoder.wasm` as a
// compiled module instead (meshopt-static.mjs) and decodes through this, the
// decoder's own `decode` step for step.

type Decode = (
  ...args: readonly [
    target: number,
    count: number,
    size: number,
    source: number,
    length: number,
  ]
) => number
type Filter = (
  ...args: readonly [target: number, count: number, size: number]
) => void
type Sbrk = (bytes: number) => number

/** The exports of `meshopt-decoder.wasm` this decoder calls. */
interface MeshoptInstance {
  readonly exports: Readonly<Record<string, unknown>>
}

/** The part of `meshoptimizer/decoder`'s interface format calls. `target` is written. */
interface MeshoptStaticDecoder {
  readonly ready: Promise<void>
  readonly supported: true
  readonly decodeGltfBuffer: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `target` is the output the caller reads
    ...args: readonly [
      target: Uint8Array,
      count: number,
      size: number,
      source: Readonly<Uint8Array>,
      mode: string,
      filter?: string,
    ]
  ) => void
}

/** The decoder's exports, by name. */
interface Exports {
  readonly heap: () => Uint8Array
  readonly sbrk: Sbrk
  readonly decoders: ReadonlyMap<string, Decode>
  readonly filters: ReadonlyMap<string, Filter>
}

/** One decode: the decoder and filter, and where the decoded elements sit in the heap. */
interface Run {
  readonly decode: Decode
  readonly filter: Filter | undefined
  readonly count: number
  readonly size: number
}

const FILTERS: ReadonlyMap<string, string> = new Map([
  ['OCTAHEDRAL', 'meshopt_decodeFilterOct'],
  ['QUATERNION', 'meshopt_decodeFilterQuat'],
  ['EXPONENTIAL', 'meshopt_decodeFilterExp'],
  ['COLOR', 'meshopt_decodeFilterColor'],
])
const DECODERS: ReadonlyMap<string, string> = new Map([
  ['ATTRIBUTES', 'meshopt_decodeVertexBuffer'],
  ['TRIANGLES', 'meshopt_decodeIndexBuffer'],
  ['INDICES', 'meshopt_decodeIndexSequence'],
])
// The decoder writes whole groups of four elements.
const GROUP = 4
const OK = 0
const START = 0

function exported(instance: Readonly<MeshoptInstance>, name: string): unknown {
  const value = instance.exports[name]
  if (value === undefined) {
    throw new TypeError(`meshopt: missing export ${name}`)
  }
  return value
}

function exportedFunctions<Value>(
  instance: Readonly<MeshoptInstance>,
  names: ReadonlyMap<string, string>,
): Map<string, Value> {
  return new Map(
    [...names].map(
      ([key, name]: readonly [string, string]): [string, Value] => [
        key,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the module is ours; the decoder calls it so
        exported(instance, name) as Value,
      ],
    ),
  )
}

function exportsOf(instance: Readonly<MeshoptInstance>): Exports {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the module is ours; its memory export
  const memory = exported(instance, 'memory') as Readonly<{
    buffer: ArrayBuffer
  }>
  return {
    heap: (): Uint8Array => new Uint8Array(memory.buffer),
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the module is ours; its allocator export
    sbrk: exported(instance, 'sbrk') as Sbrk,
    decoders: exportedFunctions<Decode>(instance, DECODERS),
    filters: exportedFunctions<Filter>(instance, FILTERS),
  }
}

/** Decode `source` into the heap and filter it; the decoder's result and the target's heap offset. */
function decodeInHeap(
  exports: Exports,
  run: Readonly<Run>,
  source: Readonly<Uint8Array>,
): readonly [number, number] {
  const groups = Math.ceil(run.count / GROUP) * GROUP
  const tp = exports.sbrk(groups * run.size)
  const sp = exports.sbrk(source.length)
  exports.heap().set(source, sp)
  const result = run.decode(tp, run.count, run.size, sp, source.length)
  if (result === OK) {
    run.filter?.(tp, groups, run.size)
  }
  return [result, tp]
}

/** The decoder's `decode`: decode, copy out, free, then refuse a malformed buffer. */
function decode(
  exports: Exports,
  run: Readonly<Run>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `target` is the output the caller reads
  io: Readonly<{ target: Uint8Array; source: Readonly<Uint8Array> }>,
): void {
  const [result, tp] = decodeInHeap(exports, run, io.source)
  io.target.set(exports.heap().subarray(tp, tp + run.count * run.size))
  exports.sbrk(tp - exports.sbrk(START))
  if (result !== OK) {
    throw new Error(`Malformed buffer data: ${String(result)}`)
  }
}

/** A decoder over `instance`, after its constructors run once. */
function meshoptDecoderFrom(
  instance: Readonly<MeshoptInstance>,
): MeshoptStaticDecoder {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the module is ours; its constructor export
  ;(exported(instance, '__wasm_call_ctors') as () => void)()
  const exports = exportsOf(instance)
  return {
    ready: Promise.resolve(),
    supported: true,
    decodeGltfBuffer: (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `target` is the output the caller reads
      ...[target, count, size, source, mode, filter]
    ): void => {
      const run = exports.decoders.get(mode)
      if (run === undefined) {
        throw new Error(`meshopt: unknown mode ${mode}`)
      }
      decode(
        exports,
        {
          decode: run,
          filter: exports.filters.get(filter ?? 'NONE'),
          count,
          size,
        },
        { target, source },
      )
    },
  }
}

export type { MeshoptInstance, MeshoptStaticDecoder }
export { meshoptDecoderFrom }
