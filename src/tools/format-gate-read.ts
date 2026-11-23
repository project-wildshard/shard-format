import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { readUsage } from '../cli/corpus-usage.ts'
import { DEPRECATIONS } from '../format/deprecations.ts'
import { FORMAT_MIGRATIONS } from '../format/format-migrations.ts'
import { readBreakFile } from './format-gate-core.ts'

import type { Usage } from '../cli/corpus-usage.ts'
import type { LockData } from '../cli/format-diff-lock.ts'
import type { BreakFile } from './format-gate-core.ts'

// SHARD-COMPAT FE4 and FE13: what the format gate reads from the tree.

const VERSION_ROW = './version#SHARDFILE_VERSION'

function versionOf(lock: Readonly<LockData>): string {
  const version = lock.rows[VERSION_ROW]
  return typeof version === 'string' ? version : '0.1'
}

async function breaksFor(
  root: string,
  version: string,
): Promise<BreakFile | undefined> {
  const file = path.join(root, 'src/format/breaks', `${version}.json`)
  const text = await readFile(file, 'utf8').catch((): undefined => undefined)
  return text === undefined ? undefined : readBreakFile(text, version)
}

async function usageFile(root: string): Promise<Usage | undefined> {
  const text = await readFile(
    path.join(root, 'corpus/usage.json'),
    'utf8',
  ).catch((): undefined => undefined)
  return text === undefined ? undefined : readUsage(text)
}

async function hasFixture(root: string, version: string): Promise<boolean> {
  const found = await stat(
    path.join(root, 'corpus/format-versions', version),
  ).catch((): undefined => undefined)
  return found?.isDirectory() === true
}

/** The chain step ids (FE8) and deprecation ids (FE7) a break file may name. */
function registryIds(): {
  readonly migrations: ReadonlySet<string>
  readonly deprecations: ReadonlySet<string>
} {
  return {
    migrations: new Set(
      FORMAT_MIGRATIONS.map(
        (step: Readonly<{ id: string }>): string => step.id,
      ),
    ),
    deprecations: new Set(
      DEPRECATIONS.map((row: Readonly<{ id: string }>): string => row.id),
    ),
  }
}

export { breaksFor, hasFixture, registryIds, usageFile, versionOf }
