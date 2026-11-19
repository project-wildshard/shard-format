import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { parseShardfile, shardfileRules } from './shardSchema.ts'

// ONE-FORMAT OF-NE21 (NEW-SHARD-E2E F21): a refused shardfile names the semantic rule that failed and the row at
// fault, so `wildshard check` can say more than "shardfile semantic rules".
test('a spawn of an undeclared species is refused by its rule and its spawn id', (): void => {
  const shard = outputFixture()
  shard.creatures.spawns.push({
    id: 'author.actor.ghost', species: 'author.nobody', variant: 'plain', at: [4, 0, 4], yaw: 0, seed: 1, scale: 1,
    brain: null, strike: null,
  })
  expect(shardfileRules(shard)).toContain('declared spawn species/variant/strike: author.actor.ghost')
  expect((): unknown => parseShardfile(shard)).toThrow(
    'shardfile semantic rules: declared spawn species/variant/strike: author.actor.ghost',
  )
})
