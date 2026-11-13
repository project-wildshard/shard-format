import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assemblyStages,
  clientPlanKinds,
  fileFamilies,
  nativeAssemblyHosts,
  runtimePlanKinds,
  sectionNames,
} from './contract-lists.ts'
import {
  CONTRACT_PATH,
  generatedBlocks,
  readContract,
  readRuntimeHosts,
  renderContract,
} from './runtime-contract.ts'

describe('docs/RUNTIME-CONTRACT.md', (): void => {
  it('matches the code: run `node src/tools/runtime-contract.ts write`', async (): Promise<void> => {
    const page = await readContract()
    const hosts = await readRuntimeHosts()
    const fresh = renderContract(page, generatedBlocks(hosts))

    assert.equal(page, fresh, `${CONTRACT_PATH} is stale`)
  })

  it('has an engine host row for exactly the sections and kinds shard-format defines', async (): Promise<void> => {
    const hosts = await readRuntimeHosts()
    const kinds = clientPlanKinds().map((row): string => row.kind)

    assert.deepEqual(Object.keys(hosts.sections).toSorted(), sectionNames())
    assert.deepEqual(Object.keys(hosts.kinds).toSorted(), kinds)
    for (const row of Object.values(hosts.sections)) {
      assert.ok(row.hosts.length > 0 || row.note !== undefined)
      for (const entry of row.hosts) {
        assert.match(entry, /^(?:page|server|both|shard-format) [\w.]+$/u)
      }
    }
  })

  it('names only real sections in the kinds it hosts', async (): Promise<void> => {
    const hosts = await readRuntimeHosts()
    const sections = new Set(sectionNames())
    for (const [kind, row] of Object.entries(hosts.kinds)) {
      for (const name of row.reads) {
        assert.ok(sections.has(name), `${kind} reads unknown section ${name}`)
      }
    }
  })
})

describe('runtime contract lists', (): void => {
  it('reads every list it publishes', (): void => {
    assert.equal(sectionNames().length, 72)
    assert.equal(clientPlanKinds().length, 63)
    assert.equal(nativeAssemblyHosts().length, 46)
    assert.deepEqual(runtimePlanKinds(), ['held-melee'])
    assert.equal(assemblyStages().length, 18)
    assert.ok(fileFamilies().length > 0)
  })

  it('refuses a page without a block marker', async (): Promise<void> => {
    const blocks = generatedBlocks(await readRuntimeHosts())

    assert.throws(
      (): string => renderContract('# no markers\n', blocks),
      /no generated:sections block/u,
    )
  })
})
