/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4f2 (Q35): the interact table's data half and the quest table compile are format laws.
// interact-table.golden.json was answered by the engine's own code (interact-table.golden-gen.mjs) over
// interact-table.golden-specs.ts, so this proves format's copies raise, read, place and compile the same.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  BINDINGS,
  PLACEMENTS,
  PLACES,
  PORTS,
  TABLE,
  answer,
} from './interact-table.golden-specs.ts'
import {
  TRANSIENT_PREFIXES,
  autoFlag,
  bindInteractPlacements,
  compileQuestTable,
  createQuestPlacements,
  flagsRaised,
  flagsRead,
  readInteractPlacements,
} from './interact-table.ts'

interface Golden {
  readonly flags: readonly unknown[]
  readonly transient: readonly string[]
  readonly compiled: readonly unknown[]
  readonly placements: readonly unknown[]
  readonly places: readonly unknown[]
  readonly floors: readonly number[]
}
const golden = JSON.parse(
  readFileSync(new URL('interact-table.golden.json', import.meta.url), 'utf8'),
) as Golden

describe('the interact table matches the engine', () => {
  it('raises and reads the same flags', () => {
    expect(
      TABLE.rows.map(row => [autoFlag(row), flagsRaised(row), flagsRead(row)]),
    ).toEqual(golden.flags)
    expect(TRANSIENT_PREFIXES).toEqual(golden.transient)
  })
  it('compiles and refuses the same quest bindings', () => {
    expect(
      BINDINGS.map(bindings =>
        answer(() => compileQuestTable(TABLE, bindings)),
      ),
    ).toEqual(golden.compiled)
  })
  it('admits, binds and refuses the same placements', () => {
    expect(
      PLACEMENTS.map(input => [
        answer(() => readInteractPlacements(input)),
        answer(() => bindInteractPlacements(TABLE, input)),
      ]),
    ).toEqual(golden.placements)
  })
  it('places quest points on the same floors and frames', () => {
    const placements = createQuestPlacements(PORTS)
    placements.setAnchor('mine', { x: 4, z: 5, yaw: 0.2 })
    expect(PLACES.map(place => answer(() => placements.place(place)))).toEqual(
      golden.places,
    )
    expect(
      [
        [0, 0],
        [25, 3],
        [-7, 2],
      ].map(([x, z]) => placements.floorAt(x ?? 0, z ?? 0)),
    ).toEqual(golden.floors)
  })
})
