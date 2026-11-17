/* oxlint-disable import/newline-after-import, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, unicorn/import-style -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4f3, from the ENGINE's ItemCatalogue (the oracle) over the corpus item tables.
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/item-catalogue.golden-gen.mjs <engine src> <out.json> <items.json>...
// Each table is embedded in the golden file beside its answers; a corpus section's `{ items }` wrapper is unwrapped.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { catalogueAnswers } from './item-catalogue.golden-specs.ts'
const { ItemCatalogue } = await import(
  join(process.argv[2], 'shared/game/loadout/itemCatalogue.ts')
)
writeFileSync(
  process.argv[3],
  `${JSON.stringify({
    about:
      'SDK-SPLIT SP4f3: engine game/loadout/itemCatalogue.ts over the corpus and shard item tables embedded here (item-catalogue.golden-specs.ts)',
    tables: process.argv.slice(4).map(path => {
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      const table = 'items' in raw ? raw.items : raw
      const name = path.split('/').slice(-4).join('/')
      return {
        name,
        table,
        answers: catalogueAnswers(input => new ItemCatalogue(input), table),
      }
    }),
  })}\n`,
)
