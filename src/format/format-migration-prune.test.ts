import { describe, expect, test } from 'vitest'

import { dropRuntimeTrust, shardfilePointer } from './format-migration-prune.ts'

import type { MigratingShard } from './format-migrations.ts'

// FORMAT-PRUNE FP8 and FP3: same-version steps that write the one way a 0.1.0.1 reader already admits.

const POINTER = '/shardfiles/pine-hollow/shard.json'
const MOUNT = 'mounts/shardfiles/pine-hollow/discovery.json'

function pointerShard(manifest: object): MigratingShard {
  return {
    index: {},
    sections: new Map<string, unknown>([['ui/level', { manifest }]]),
    mounts: new Map<string, unknown>([
      [MOUNT, { version: 1, data: { gridShardfile: POINTER, title: 'Pine' } }],
    ]),
  }
}

describe('fp8-shardfile-pointer', (): void => {
  test('renames gridShardfile in the level manifest and the discovery mount, keeping key order', (): void => {
    const shard = pointerShard({ gridShardfile: POINTER, bindings: {} })
    expect(shardfilePointer.repairs?.(shard)).toBe(true)
    shardfilePointer.apply(shard)
    expect(shard.sections.get('ui/level')).toEqual({
      manifest: { shardfile: POINTER, bindings: {} },
    })
    expect(JSON.stringify(shard.mounts.get(MOUNT))).toBe(
      JSON.stringify({
        version: 1,
        data: { shardfile: POINTER, title: 'Pine' },
      }),
    )
    expect(shardfilePointer.repairs?.(shard)).toBe(false)
  })

  test('drops a duplicate pointer and refuses two different files', (): void => {
    const same = pointerShard({ gridShardfile: POINTER, shardfile: POINTER })
    shardfilePointer.apply(same)
    expect(same.sections.get('ui/level')).toEqual({
      manifest: { shardfile: POINTER },
    })
    expect((): void => {
      shardfilePointer.apply(
        pointerShard({ gridShardfile: POINTER, shardfile: '/other.json' }),
      )
    }).toThrow('names its shardfile once')
  })
})

describe('fp3-drop-runtime-trust', (): void => {
  test('drops runtime.trust and leaves the rest', (): void => {
    const shard: MigratingShard = {
      index: { runtime: { kind: 'client-plan', trust: 'first-party' } },
      sections: new Map(),
      mounts: new Map(),
    }
    expect(dropRuntimeTrust.repairs?.(shard)).toBe(true)
    dropRuntimeTrust.apply(shard)
    expect(shard.index).toEqual({ runtime: { kind: 'client-plan' } })
    expect(dropRuntimeTrust.repairs?.(shard)).toBe(false)
  })
})
