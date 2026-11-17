/* oxlint-disable capitalized-comments, id-length, import/newline-after-import, import/no-nodejs-modules, no-magic-numbers, node/no-sync, prefer-named-capture-group, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/prefer-readonly-parameter-types, unicorn/import-style, unicorn/max-nested-calls -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4f1, from the ENGINE's HEADLESS_CONTEXT_SECTIONS / headlessSections /
// productHeadlessSections, ROAD_SKY, FAR_CLIFF_FLOOR and moverChannelValues (the oracle).
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/small-laws.golden-gen.mjs <engine src> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  MOVER_CASES,
  SECTION_INPUTS,
  answer,
} from './small-laws.golden-specs.ts'
const { HEADLESS_CONTEXT_SECTIONS, headlessSections, productHeadlessSections } =
  await import(join(process.argv[2], 'shared/host/headlessSections.ts'))
const { ROAD_SKY } = await import(
  join(process.argv[2], 'client/game/grid/frameModel.ts')
)
// farView pulls the renderer's shader patches, which the sim loader refuses: its one numeric constant is read from source
const FAR_CLIFF_FLOOR = Number(
  /^export const FAR_CLIFF_FLOOR = ([0-9.]+);$/mu.exec(
    readFileSync(join(process.argv[2], 'client/game/grid/farView.ts'), 'utf8'),
  )?.[1],
)
const { moverChannelValues } = await import(
  join(process.argv[2], 'client/game/plugin/clientChannelView.ts')
)
const product = pairs => ({
  has: name => pairs.some(([n]) => n === name),
  section: name => pairs.find(([n]) => n === name)?.[1],
})
writeFileSync(
  process.argv[3],
  `${JSON.stringify({
    about:
      'SDK-SPLIT SP4f1: engine host/headlessSections.ts, grid/frameModel.ts ROAD_SKY, grid/farView.ts FAR_CLIFF_FLOOR and plugin/clientChannelView.ts moverChannelValues over small-laws.golden-specs.ts',
    sectionNames: HEADLESS_CONTEXT_SECTIONS,
    sections: SECTION_INPUTS.map(pairs => [
      answer(() => headlessSections(new Map(pairs))),
      answer(() => productHeadlessSections(product(pairs))),
    ]),
    roadSky: ROAD_SKY,
    farCliffFloor: FAR_CLIFF_FLOOR,
    mover: MOVER_CASES.map(c =>
      answer(() => moverChannelValues(c.reads, c.pose, c.fields)),
    ),
  })}\n`,
)
