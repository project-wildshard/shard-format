import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decodeClassTables, encodeClassTables } from '../src/class-tables.ts'
import { ANIMAL, WIRE_CLASSES } from '../src/classes.ts'
import { classColumns } from '../src/columns.ts'
import {
  encodeEvents,
  eventsDecoder,
  eventTables,
} from '../src/event-stream.ts'
import { projectClasses } from '../src/projection.ts'
import { spawnColumns } from '../src/spawn-columns.ts'
import { onlyRecord, refuses } from './helpers/codec.ts'

import type { ClassColumns } from '../src/columns.ts'
import type { WireClass } from '../src/grammar.ts'

// WR4: the welcome's class tables round-trip and a peer's are checked; a
// spawn of a class the receiver doesn't know is read whole and presents
// nothing. rides.test.ts holds ride laws and capabilities.

function byId(
  classes: readonly WireClass[],
): (id: number) => ClassColumns | undefined {
  return (id: number): ClassColumns | undefined => {
    const found = classes.find((entry: WireClass): boolean => entry.id === id)
    return found === undefined ? undefined : classColumns(found)
  }
}

test('the class tables round-trip by id, with audience, prediction and relevance', (): void => {
  const peer = decodeClassTables(encodeClassTables(WIRE_CLASSES))
  assert.equal(peer.length, WIRE_CLASSES.length)
  const local: readonly WireClass[] = WIRE_CLASSES
  for (const [index, mine] of local.entries()) {
    const theirs = peer[index]
    assert.ok(theirs)
    assert.equal(theirs.id, mine.id)
    assert.equal(theirs.relevance, mine.relevance)
    assert.deepEqual(classColumns(theirs), classColumns(mine))
  }
  // Projection by id needs no names: the peer's classes project onto ours.
  assert.equal(projectClasses(peer, WIRE_CLASSES).size, WIRE_CLASSES.length)
})

test('a peer class table with a double in a row, or a struct column, refuses', (): void => {
  const doubled: WireClass = {
    id: 9,
    name: 'odd',
    fields: [{ id: 1, name: 'x', node: { kind: 'f64' } }],
  }
  const nested: WireClass = {
    id: 9,
    name: 'odd',
    fields: [{ id: 1, name: 'x', node: { kind: 'struct', fields: [] } }],
  }
  for (const wireClass of [doubled, nested]) {
    refuses((): unknown => decodeClassTables(encodeClassTables([wireClass])))
  }
})

test('a spawn of a class the receiver lacks is read whole and its neighbours apply', (): void => {
  const sender = [
    ...WIRE_CLASSES,
    {
      id: 7,
      name: 'kite',
      fields: [
        { id: 1, name: 'tail', node: { kind: 'uint', bits: 12 } },
        {
          id: 2,
          name: 'label',
          node: { kind: 'text', maxBytes: 255 },
          send: 'initial',
        },
      ],
    } satisfies WireClass,
  ]
  const kite = { handle: 9, cls: 7, id: 'kite:1', initial: [], text: ['red'] }
  const animal = {
    handle: 10,
    cls: ANIMAL.id,
    id: 'animal:2',
    initial: [1_065_353_216, 77],
    text: ['wolf', 'grey', 'common'],
  }
  const bytes = encodeEvents(
    5,
    [
      { event: 'spawn', fields: kite },
      { event: 'spawn', fields: animal },
    ],
    spawnColumns(byId(sender)),
  )
  const read = eventsDecoder(
    eventTables(),
    spawnColumns(byId(sender)),
  )(onlyRecord(bytes))
  assert.deepEqual(
    read.events.map(
      (event: { readonly fields: unknown }): unknown => event.fields,
    ),
    [kite, animal],
  )
  // The receiver projects only the classes it has.
  const projections = projectClasses(sender, WIRE_CLASSES)
  assert.equal(projections.has(7), false)
  assert.ok(projections.get(ANIMAL.id))
})
