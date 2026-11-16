import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assembleOutputShardfile,
  parseOutputIndex,
} from '../../format/outputIndex.ts'

import type { Shardfile } from '../../format/shardSchema.ts'

function readJson(file: string): unknown {
  const text = readFileSync(file, 'utf8')
  return JSON.parse(text)
}

/** Load the checked-in CLI product through its normal section assembly and admission. */
export function outputFixture(kind: 'cli' | 'handwritten' = 'cli'): Shardfile {
  const relative =
    kind === 'cli' ? '../fixtures/cli-fixture/' : '../../../corpus/handwritten/'
  const root = fileURLToPath(new URL(relative, import.meta.url))
  const indexFile = path.join(root, 'shard.json')
  const index = parseOutputIndex(readJson(indexFile))
  const sections = new Map<string, unknown>()
  for (const section of index.sections) {
    const file = path.join(root, section.path)
    sections.set(section.name, readJson(file))
  }
  return assembleOutputShardfile(index, sections)
}
