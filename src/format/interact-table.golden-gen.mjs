/* oxlint-disable id-length, import/newline-after-import, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/prefer-readonly-parameter-types, unicorn/import-style -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4f2, from the ENGINE's world/interact/types.ts and game/plugin/quests.ts (the oracle).
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/interact-table.golden-gen.mjs <engine src> <out.json>
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  BINDINGS,
  PLACEMENTS,
  PLACES,
  PORTS,
  TABLE,
  answer,
} from './interact-table.golden-specs.ts'
const {
  autoFlag,
  flagsRaised,
  flagsRead,
  readInteractPlacements,
  bindInteractPlacements,
  createQuestPlacements,
  TRANSIENT_PREFIXES,
} = await import(join(process.argv[2], 'shared/engine/world/interact/types.ts'))
const { compileQuestTable } = await import(
  join(process.argv[2], 'shared/game/plugin/quests.ts')
)
const placements = createQuestPlacements(PORTS)
placements.setAnchor('mine', { x: 4, z: 5, yaw: 0.2 })
writeFileSync(
  process.argv[3],
  `${JSON.stringify({
    about:
      'SDK-SPLIT SP4f2: engine world/interact/types.ts and game/plugin/quests.ts compileQuestTable over interact-table.golden-specs.ts',
    flags: TABLE.rows.map(row => [
      autoFlag(row),
      flagsRaised(row),
      flagsRead(row),
    ]),
    transient: TRANSIENT_PREFIXES,
    compiled: BINDINGS.map(bindings =>
      answer(() => compileQuestTable(TABLE, bindings)),
    ),
    placements: PLACEMENTS.map(input => [
      answer(() => readInteractPlacements(input)),
      answer(() => bindInteractPlacements(TABLE, input)),
    ]),
    places: PLACES.map(place => answer(() => placements.place(place))),
    floors: [
      [0, 0],
      [25, 3],
      [-7, 2],
    ].map(([x, z]) => placements.floorAt(x, z)),
  })}\n`,
)
