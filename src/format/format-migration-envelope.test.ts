// oxlint-disable typescript/prefer-readonly-parameter-types -- a test hands the step a shard it edits in place
import { describe, expect, test } from 'vitest'

import { deprecationsUsed } from './deprecations.ts'
import { dropRequiresCapabilities } from './format-migration-envelope.ts'

import type { MigratingShard } from './format-migrations.ts'

function used(shard: Readonly<MigratingShard>): readonly string[] {
  return deprecationsUsed({ index: shard.index, sections: shard.sections }).map(
    (row: Readonly<{ id: string }>): string => row.id,
  )
}

// FORMAT-PRUNE FP4 (J505 build-ahead): `requires.capabilities`, empty in every pin and never read, is dropped by a repair
// step, and the schema admits a writer that no longer sources it.

describe('fp4-drop-requires-capabilities', (): void => {
  test('drops requires.capabilities and leaves the rest', (): void => {
    const shard: MigratingShard = {
      index: { requires: { capabilities: [], commons: [] } },
      sections: new Map(),
      mounts: new Map(),
    }
    expect(dropRequiresCapabilities.repairs?.(shard)).toBe(true)
    expect(used(shard)).toContain('requires.capabilities')
    dropRequiresCapabilities.apply(shard)
    expect(shard.index).toEqual({ requires: { commons: [] } })
    expect(dropRequiresCapabilities.repairs?.(shard)).toBe(false)
    expect(used(shard)).not.toContain('requires.capabilities')
  })
})
