import {
  array,
  integer,
  literal,
  maxValue,
  minValue,
  number,
  parse,
  pipe,
  regex,
  strictObject,
  string,
  unknown,
} from 'valibot'

import {
  Dictionary,
  expand,
  nodeOf,
  MAX_EXPANDED,
  MAX_NODES,
} from './capture-graph.ts'
import { sealGraphPart, openGraphPart } from './graph-part.ts'
import { ENGINE, parseSession, parseStoredSession } from './session-data.ts'

import type { Node } from './capture-graph.ts'
import type { CapturedSession } from './session-data.ts'

const ZERO = 0
const ONE = 1
const TWO = 2
const THREE = 3
const HEX = 16
const MAX_PART = 1_000_000
const MAX_ARCHIVE = 5_000_000
const MAX_GRAPH = 20_000_000
const encoder = new TextEncoder()
const natural = pipe(number(), integer(), minValue(ZERO))
const positive = pipe(natural, minValue(ONE))
const boundedNodes = pipe(positive, maxValue(MAX_NODES))
const hash = pipe(string(), regex(/^[a-f0-9]{64}$/u))
const PartSchema = strictObject({
  file: pipe(string(), regex(/^part-[0-9]{3}\.json$/u)),
  start: natural,
  count: positive,
  bytes: pipe(positive, maxValue(MAX_PART)),
  expandedBytes: pipe(positive, maxValue(MAX_PART)),
  hash,
})
const HeaderSchema = strictObject({
  format: literal('wire-capture-graph/1'),
  engine: literal(ENGINE),
  product: string(),
  ticks: positive,
  root: natural,
  nodes: boundedNodes,
  expandedBytes: pipe(positive, maxValue(MAX_EXPANDED)),
  hash,
  parts: array(PartSchema),
})
interface Part {
  readonly file: string
  readonly start: number
  readonly count: number
  readonly bytes: number
  readonly expandedBytes: number
  readonly hash: string
}
interface Header {
  readonly format: 'wire-capture-graph/1'
  readonly engine: typeof ENGINE
  readonly product: string
  readonly ticks: number
  readonly root: number
  readonly nodes: number
  readonly expandedBytes: number
  readonly hash: string
  readonly parts: readonly Part[]
}
interface GraphArchive {
  readonly manifest: Header
  readonly files: ReadonlyMap<string, Readonly<Uint8Array>>
}
function headerOf(
  value: unknown,
): ReturnType<typeof parse<typeof HeaderSchema>> {
  return parse(HeaderSchema, value)
}
function bytes(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value)}\n`)
}
async function digest(data: Readonly<Uint8Array>): Promise<string> {
  const result = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(data).buffer,
  )
  return Array.from(new Uint8Array(result), (byte: number): string =>
    byte.toString(HEX).padStart(TWO, '0'),
  ).join('')
}
function partName(index: number): string {
  return `part-${String(index).padStart(THREE, '0')}.json`
}
function budget(header: Header): void {
  if (
    header.parts.length === ZERO ||
    header.parts.reduce(
      (sum: number, part: Part): number => sum + part.expandedBytes,
      ZERO,
    ) > MAX_GRAPH ||
    header.parts.reduce(
      (sum: number, part: Part): number => sum + part.bytes,
      bytes(header).length,
    ) > MAX_ARCHIVE
  ) {
    throw new Error('Capture graph exceeds its archive budget')
  }
}
class PartBuilder {
  public readonly pieces: Uint8Array[] = []
  public readonly starts: number[] = []
  public readonly counts: number[] = []
  private items: Node[] = []
  private size = THREE
  private start = ZERO
  public flush(): void {
    if (this.items.length === ZERO) {
      return
    }
    this.pieces.push(bytes(this.items))
    this.starts.push(this.start)
    this.counts.push(this.items.length)
    this.start += this.items.length
    this.items = []
    this.size = THREE
  }
  public add(node: Node): void {
    const { length } = bytes(node)
    if (length + THREE > MAX_PART) {
      throw new Error('Capture graph node exceeds its file budget')
    }
    if (this.size + length > MAX_PART) {
      this.flush()
    }
    this.items.push(node)
    this.size += length
  }
  public async seal(): Promise<readonly Part[]> {
    this.flush()
    return await Promise.all(
      this.pieces.map(
        async (data: Readonly<Uint8Array>, index: number): Promise<Part> => {
          const packed = await sealGraphPart(data)
          this.pieces[index] = packed
          return {
            file: partName(index),
            start: this.starts[index] ?? ZERO,
            count: this.counts[index] ?? ZERO,
            bytes: packed.length,
            expandedBytes: data.length,
            hash: await digest(packed),
          }
        },
      ),
    )
  }
}
function capture(value: unknown): {
  readonly document: Uint8Array
  readonly dictionary: Dictionary
  readonly root: number
  readonly product: string
  readonly ticks: number
} {
  const source = parseStoredSession(value)
  const document = bytes(source)
  const dictionary = new Dictionary()
  if (document.length > MAX_EXPANDED) {
    throw new Error('Capture graph exceeds its expanded budget')
  }
  const root = dictionary.put(JSON.parse(new TextDecoder().decode(document)))
  return {
    document,
    dictionary,
    root,
    product: source.product,
    ticks: source.ticks,
  }
}
/** Lossless structural sharing for dense captures; the frozen codec remains unchanged. */
async function archiveGraphSession(value: unknown): Promise<GraphArchive> {
  const source = capture(value)
  const builder = new PartBuilder()
  for (const node of source.dictionary.nodes) {
    builder.add(node)
  }
  const parts = await builder.seal()
  const manifest: Header = {
    format: 'wire-capture-graph/1',
    engine: ENGINE,
    product: source.product,
    ticks: source.ticks,
    root: source.root,
    nodes: source.dictionary.nodes.length,
    expandedBytes: source.document.length,
    hash: await digest(source.document),
    parts,
  }
  budget(manifest)
  const files = new Map(
    builder.pieces.map(
      (
        data: Readonly<Uint8Array>,
        index: number,
      ): readonly [string, Readonly<Uint8Array>] => [partName(index), data],
    ),
  )
  return { manifest, files }
}
async function readPart(
  part: Part,
  read: (file: string) => Promise<Readonly<Uint8Array>>,
): Promise<readonly Node[]> {
  const data = await read(part.file)
  if (data.length !== part.bytes || (await digest(data)) !== part.hash) {
    throw new Error('Capture graph part bytes differ')
  }
  const expanded = await openGraphPart(data, part.expandedBytes)
  const items = parse(
    array(unknown()),
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(expanded)),
  )
  if (items.length !== part.count) {
    throw new Error('Capture graph part count differs')
  }
  return items.map((item: unknown): Node => nodeOf(item))
}
function validateParts(header: Header): void {
  let count = ZERO
  for (const [index, part] of header.parts.entries()) {
    if (
      part.file !== partName(index) ||
      part.start !== count ||
      count + part.count > header.nodes
    ) {
      throw new Error('Capture graph parts must be complete and ordered')
    }
    count += part.count
  }
  if (count !== header.nodes || header.root !== count - ONE) {
    throw new Error('Capture graph content is incomplete')
  }
}
async function validateContent(
  header: Header,
  nodes: readonly Node[],
): Promise<CapturedSession> {
  const source = expand(nodes, header.root)
  const document = bytes(source)
  if (
    document.length !== header.expandedBytes ||
    (await digest(document)) !== header.hash
  ) {
    throw new Error('Capture graph expanded content differs')
  }
  const session = parseSession(source)
  if (session.product !== header.product || session.ticks !== header.ticks) {
    throw new Error('Capture graph metadata differs')
  }
  return session
}
/** Hash, reconstruct and frozen-replay all content before returning a dense session. */
async function readGraphSession(
  value: unknown,
  read: (file: string) => Promise<Readonly<Uint8Array>>,
): Promise<CapturedSession> {
  const header = headerOf(value)
  budget(header)
  validateParts(header)
  const groups = await Promise.all(
    header.parts.map(
      async (part: Part): Promise<readonly Node[]> =>
        await readPart(part, read),
    ),
  )
  return await validateContent(header, groups.flat())
}

export { archiveGraphSession, readGraphSession, type GraphArchive }
