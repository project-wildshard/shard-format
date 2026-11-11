import { compileDecoder, compileEncoder } from './codec.ts'
import { WireDecodeError } from './wire-error.ts'

import type { BitSink, BitSource } from './bit-io.ts'
import type { WireStruct, WireValue } from './codec.ts'
import type { ClassColumns } from './columns.ts'
import type { SpawnColumns } from './event-stream.ts'

// WIRE-STABILITY 5.3: a spawn is its handle, its class id and its stable id,
// then that class's initial words and spawn text in the sender's class table.
// A spawn of a class the receiver doesn't know is still read whole, by the
// sender's table, and kept as opaque metadata: it presents nothing.

/** The spawn's tail: `initial` words and `text` strings, in sender order. */
interface SpawnTail {
  readonly initial: readonly number[]
  readonly text: readonly string[]
}

const TEXT = { kind: 'text', maxBytes: 255 } as const
const writeText = compileEncoder(TEXT)
const readText = compileDecoder(TEXT, TEXT)
const NONE = 0
const textOf = (value: WireValue): string =>
  typeof value === 'string' ? value : ''

const listOf = (value: WireValue): readonly WireValue[] =>
  Array.isArray(value) ? (value as readonly WireValue[]) : []

/** Spawn columns by the sender's classes, keyed by class id. */
function spawnColumns(
  classOf: (id: number) => ClassColumns | undefined,
): SpawnColumns {
  const columnsOf = (fields: WireStruct): ClassColumns => {
    const columns = classOf(
      typeof fields['cls'] === 'number' ? fields['cls'] : NONE,
    )
    if (columns === undefined) {
      throw new WireDecodeError('A spawn names a class its sender table lacks')
    }
    return columns
  }
  return {
    write: (writer: BitSink, fields: WireStruct): void => {
      const columns = columnsOf(fields)
      const initial = listOf(fields['initial'])
      for (const [index, column] of columns.initial.entries()) {
        const word = initial[index]
        writer.write(typeof word === 'number' ? word : NONE, column.bits)
      }
      for (const [index] of columns.text.entries()) {
        writeText(writer, listOf(fields['text'])[index] ?? '')
      }
    },
    read: (reader: BitSource, fields: WireStruct): WireStruct => {
      const columns = columnsOf(fields)
      const tail: SpawnTail = {
        initial: columns.initial.map((column): number =>
          reader.read(column.bits),
        ),
        text: columns.text.map((): string => textOf(readText(reader))),
      }
      return { ...fields, initial: tail.initial, text: tail.text }
    },
  }
}

export { spawnColumns, type SpawnTail }
