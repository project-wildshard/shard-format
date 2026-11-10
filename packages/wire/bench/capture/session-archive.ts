import {
  array,
  literal,
  maxValue,
  minLength,
  minValue,
  number,
  integer,
  parse,
  picklist,
  pipe,
  regex,
  strictObject,
  string,
  unknown,
} from 'valibot'

import {
  VERSION,
  ENGINE,
  parseStoredSession,
  parseSession,
} from './session-data.ts'

import type { StoredSession, CapturedSession } from './session-data.ts'

const MAX_BYTES = 1_000_000
const MAX_TOTAL = 5_000_000
const HEX = 16
const ZERO = 0
const ONE = 1
const TWO = 2
const THREE = 3
const encoder = new TextEncoder()
const positive = pipe(number(), integer(), minValue(ONE))
const hash = pipe(string(), regex(/^[a-f0-9]{64}$/u))
const count = pipe(number(), integer(), minValue(ZERO))
const kinds = ['words', 'frames', 'packets'] as const
const kind = picklist(kinds)
const PartSchema = strictObject({
  file: pipe(string(), regex(/^part-[0-9]{3}\.json$/u)),
  kind,
  start: count,
  count: positive,
  bytes: pipe(positive, maxValue(MAX_BYTES)),
  hash,
})
const ManifestSchema = strictObject({
  format: literal('wire-capture-json/1'),
  engine: literal(ENGINE),
  product: string(),
  ticks: positive,
  bytes: pipe(positive, maxValue(MAX_TOTAL)),
  hash,
  parts: pipe(array(PartSchema), minLength(ONE)),
})
type PartKind = (typeof kinds)[number]
interface SessionPart {
  readonly file: string
  readonly kind: PartKind
  readonly start: number
  readonly count: number
  readonly bytes: number
  readonly hash: string
}
interface SessionManifest {
  readonly format: 'wire-capture-json/1'
  readonly engine: typeof ENGINE
  readonly product: string
  readonly ticks: number
  readonly bytes: number
  readonly hash: string
  readonly parts: readonly SessionPart[]
}
interface SessionArchive {
  readonly manifest: SessionManifest
  readonly files: ReadonlyMap<string, Readonly<Uint8Array>>
}
interface PartDraft {
  readonly kind: PartKind
  readonly start: number
  readonly count: number
  readonly data: Readonly<Uint8Array>
}
function bytes(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(value)}\n`)
}
function partName(index: number): string {
  return `part-${String(index).padStart(THREE, '0')}.json`
}
async function digest(input: Readonly<Uint8Array>): Promise<string> {
  const sum = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(input).buffer,
  )
  return Array.from(new Uint8Array(sum), (byte: number): string =>
    byte.toString(HEX).padStart(TWO, '0'),
  ).join('')
}
class PartBuilder {
  private readonly output: PartDraft[] = []
  private items: unknown[] = []
  private start = ZERO
  private length = THREE
  private readonly kind: PartKind
  public constructor(kindName: PartKind) {
    this.kind = kindName
  }
  private flush(): void {
    if (this.items.length === ZERO) {
      return
    }
    this.output.push({
      kind: this.kind,
      start: this.start,
      count: this.items.length,
      data: bytes(this.items),
    })
    this.start += this.items.length
    this.items = []
    this.length = THREE
  }
  public add(value: unknown): void {
    const size = bytes(value).byteLength
    if (size + THREE > MAX_BYTES) {
      throw new Error('One captured value exceeds the repository file cap')
    }
    if (this.length + size > MAX_BYTES) {
      this.flush()
    }
    this.items.push(value)
    this.length += size
  }
  public finish(): readonly PartDraft[] {
    this.flush()
    return this.output
  }
}
function split(
  kindName: PartKind,
  values: readonly unknown[],
): readonly PartDraft[] {
  const builder = new PartBuilder(kindName)
  for (const value of values) {
    builder.add(value)
  }
  return builder.finish()
}
function budget(manifest: SessionManifest): void {
  const header = bytes(manifest).byteLength
  if (
    header > MAX_BYTES ||
    manifest.parts.reduce(
      (sum: number, part): number => sum + part.bytes,
      header,
    ) > MAX_TOTAL
  ) {
    throw new Error(
      'Archived recording exceeds its per-file or whole-session budget',
    )
  }
}
async function seal(draft: PartDraft, index: number): Promise<SessionPart> {
  return {
    file: partName(index),
    kind: draft.kind,
    start: draft.start,
    count: draft.count,
    bytes: draft.data.byteLength,
    hash: await digest(draft.data),
  }
}
function drafts(source: StoredSession): readonly PartDraft[] {
  return [
    ...split('words', source.frames.wordTable),
    ...split('frames', source.frames.frames),
    ...split('packets', source.packets),
  ]
}
/** Lossless whole arrays keep every repository file below 1 MB without a bypass. */
async function archiveSession(value: unknown): Promise<SessionArchive> {
  const source = parseStoredSession(value)
  const document = bytes(source)
  const pieces = drafts(source)
  if (document.byteLength > MAX_TOTAL) {
    throw new Error('Recording exceeds the 5 MB whole-session budget')
  }
  const parts = await Promise.all(
    pieces.map(
      async (piece: PartDraft, index: number): Promise<SessionPart> =>
        await seal(piece, index),
    ),
  )
  const manifest: SessionManifest = {
    format: 'wire-capture-json/1',
    engine: ENGINE,
    product: source.product,
    ticks: source.ticks,
    bytes: document.byteLength,
    hash: await digest(document),
    parts,
  }
  budget(manifest)
  const files = new Map(
    pieces.map(
      (
        piece: PartDraft,
        index: number,
      ): readonly [string, Readonly<Uint8Array>] => [
        partName(index),
        piece.data,
      ],
    ),
  )
  return { manifest, files }
}
async function readPart(
  part: SessionPart,
  read: (file: string) => Promise<Readonly<Uint8Array>>,
): Promise<readonly unknown[]> {
  const data = await read(part.file)
  if (data.byteLength !== part.bytes || (await digest(data)) !== part.hash) {
    throw new Error('Recording part bytes differ from the manifest')
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data)
  const value: unknown = JSON.parse(text)
  const items = parse(array(unknown()), value)
  if (items.length !== part.count) {
    throw new Error('Recording part count differs from the manifest')
  }
  return items
}
function join(
  manifest: SessionManifest,
  rows: readonly (readonly unknown[])[],
): unknown {
  const sections: Record<PartKind, unknown[]> = {
    words: [],
    frames: [],
    packets: [],
  }
  let rank = ZERO
  for (const [index, part] of manifest.parts.entries()) {
    const next = kinds.indexOf(part.kind)
    if (
      part.file !== partName(index) ||
      next < rank ||
      part.start !== sections[part.kind].length
    ) {
      throw new Error('Recording parts must be complete and ordered')
    }
    rank = next
    for (const value of rows[index] ?? []) {
      sections[part.kind].push(value)
    }
  }
  return {
    version: VERSION,
    engine: ENGINE,
    product: manifest.product,
    ticks: manifest.ticks,
    frames: {
      version: VERSION,
      wordTable: sections.words,
      frames: sections.frames,
    },
    packets: sections.packets,
  }
}
/** Verify complete storage and mandatory frozen replay before returning any recording. */
async function readSessionArchive(
  value: unknown,
  read: (file: string) => Promise<Readonly<Uint8Array>>,
): Promise<CapturedSession> {
  const manifest = parse(ManifestSchema, value)
  budget(manifest)
  const rows = await Promise.all(
    manifest.parts.map(
      async (part: SessionPart): Promise<readonly unknown[]> =>
        await readPart(part, read),
    ),
  )
  const document = join(manifest, rows)
  const data = bytes(document)
  if (
    data.byteLength !== manifest.bytes ||
    (await digest(data)) !== manifest.hash
  ) {
    throw new Error('Recording content differs from the manifest')
  }
  return parseSession(document)
}

export {
  archiveSession,
  readSessionArchive,
  type SessionArchive,
  type SessionManifest,
}
