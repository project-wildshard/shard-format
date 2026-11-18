/* oxlint-disable curly, no-continue, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/prefer-readonly-parameter-types, unicorn/import-style, unicorn/no-null -- calibration oracle over real products */
// MEMORY-GATES MG6 (mini-em11b, 2026-11-18, memory epoch 5): the paired table. Each pinned product's offline estimate,
// its terms, and what ENGINE-MEMORY EM11's phone chain predicts for it from native WebKit. Regenerate after any model
// change or EM11 sweep (the change bumps MEMORY_EPOCH, which memory-calibration.test.ts holds this file to):
//   node src/format/memory-calibration.golden-gen.mjs <engine>/test/pins/shardfiles.json <pinned tar folder> src/format/memory-calibration.em11.json src/format/memory-calibration.golden.json
// The tar folder is engine's pin cache (`~/.cache/wildshard/pins`, `<hash>.tar`). It refuses to write a zone whose
// estimate falls under the upper bound of EM11's prediction.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { bootMemoryCosts, mountedImageBytes } from './boot-memory-cost.ts'
import { worstContentCost } from './budget.ts'
import { MEMORY_EPOCH } from './memory-epoch.ts'
import { runtimeOfflineBytes } from './memory-line.ts'
import { assembleOutputShardfile, parseOutputIndex } from './outputIndex.ts'
import { mountSharesBlob } from './shardfile-reads.ts'
import { readTar } from './tar.ts'

const MB = 1e6
const [pinsFile, tarFolder, em11File, out] = process.argv.slice(2)
// EM11's every-zone sweep (memory-em11.mjs): per zone, runs, then playing (settled) central and upper bound, then
// loading peak central and upper bound, decimal MB, read on the engine build it names.
const em11 = JSON.parse(readFileSync(em11File, 'utf8'))
const decoder = new TextDecoder()
const zones = []
for (const pin of JSON.parse(readFileSync(pinsFile, 'utf8')).shards) {
  const reading = em11.zones[pin.slug]
  if (reading === undefined) continue
  const {
    runs,
    playingMB: playingCentral,
    playingHighMB: playingHigh,
    loadingMB: loadingCentral,
    loadingHighMB: loadingHigh,
  } = reading
  const files = readTar(readFileSync(join(tarFolder, `${pin.hash}.tar`)))
  const raw = JSON.parse(decoder.decode(files.get('shard.json')))
  const index = parseOutputIndex(raw)
  const sections = new Map(
    index.sections.map(entry => [
      entry.name,
      JSON.parse(decoder.decode(files.get(entry.path))),
    ]),
  )
  const shard = assembleOutputShardfile(raw, sections)
  const cook =
    index.cook === undefined
      ? { mounts: [] }
      : JSON.parse(decoder.decode(files.get(index.cook.path)))
  let mountedImages = 0
  for (const mount of cook.mounts ?? [])
    if (!mountSharesBlob(mount, index.files))
      mountedImages += mountedImageBytes(mount.path, files.get(mount.path))
  const native =
    shard.runtime?.cost === undefined
      ? 0
      : runtimeOfflineBytes(shard.runtime.cost)
  const commons =
    native +
    Object.values(shard.requires.commonsCosts).reduce(
      (sum, row) => sum + row.decoded + row.gpu,
      0,
    )
  const boot = bootMemoryCosts(shard, sections, { mountedImages, index })
  const estimate = worstContentCost(shard, { commons, boot })
  const zone = {
    slug: pin.slug,
    revision: pin.revision,
    tar: pin.hash,
    em11: {
      runs,
      playingMB: playingCentral,
      playingHighMB: playingHigh,
      loadingMB: loadingCentral,
      loadingHighMB: loadingHigh,
    },
    playing: estimate.playing,
    loading: estimate.loading,
    terms: boot.terms,
  }
  for (const [kind, high] of [
    ['playing', playingHigh],
    ['loading', loadingHigh],
  ])
    if (zone[kind] < high * MB)
      throw new Error(
        `${pin.slug}: ${kind} estimate ${zone[kind]} under EM11's ${high} MB upper bound`,
      )
  zones.push(zone)
}
writeFileSync(
  out,
  `${JSON.stringify({ epoch: MEMORY_EPOCH, engine: em11.engine, measured: em11.measured, source: 'meta MEMORY-GATES MG6 / ENGINE-MEMORY EM11; engine test/pins/shardfiles.json; memory-calibration.em11.json', zones }, null, 1)}\n`,
)
