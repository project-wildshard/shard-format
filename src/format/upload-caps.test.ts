import { readdirSync, readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { MAX_SHARDFILE_BYTES } from './upload-caps.ts'

const folder = new URL('./', import.meta.url)

function isModule(name: string): boolean {
  return (
    name.endsWith('.ts') &&
    name !== 'upload-caps.ts' &&
    !name.endsWith('.test.ts')
  )
}

function holdsCopy(name: string): boolean {
  return /\b450_?000_?000\b/u.test(readFileSync(new URL(name, folder), 'utf8'))
}

// EG-8: one cap for every host. A change here is a change for the API and the cook at once.
test('the shardfile cap is 450 MB', (): void => {
  expect(MAX_SHARDFILE_BYTES).toBe(450_000_000)
})

test('no format module keeps its own copy of the cap', (): void => {
  const copies = readdirSync(folder).filter(
    (name): boolean => isModule(name) && holdsCopy(name),
  )
  expect(copies).toEqual([])
})
