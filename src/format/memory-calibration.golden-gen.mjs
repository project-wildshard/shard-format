/* oxlint-disable curly, no-continue, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/prefer-readonly-parameter-types, unicorn/import-style, unicorn/no-null -- calibration oracle over real products */
// MEMORY-GATES MG6 (mini-em11b, 2026-11-18, memory epoch 5): the paired table. Each pinned product's offline estimate,
// its terms, and what ENGINE-MEMORY EM11's phone chain predicts for it from native WebKit. Regenerate after any model
// change (the change bumps MEMORY_EPOCH, which memory-calibration.test.ts holds this file to):
//   node src/format/memory-calibration.golden-gen.mjs <engine>/test/pins/shardfiles.json <pinned tar folder> src/format/memory-calibration.golden.json
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

// EM11 (mini-em11b, 2026-11-18 00:40-01:40 Cancun): engine `scripts/memory/measure.mjs --instrument=minimal` (the Web
// Inspector's Network and Console domains off) on engine main `037d9f15` with all 27 catalogue pins, Mac mini, headless
// Playwright WebKit, phone tier Low, cold boots (3 runs; 2 for each Open Plots plot), through `phone-model.json` (refit
// on the same readings). Per zone: runs, then playing (settled) central and upper bound, then loading peak central and
// upper bound, decimal MB. The central figure is the median run's; the upper bound is the highest run's, so a zone's
// bound holds for every run read.
const EM11 = {
  template: [3, 614, 684, 820, 971],
  'brasscap-mesa': [3, 629, 705, 876, 1013],
  'driftwood-isle': [3, 1000, 1136, 1194, 1404],
  'far-reach': [3, 739, 911, 993, 1153],
  'ink-cel-valley': [3, 551, 610, 745, 872],
  'nalati-grasslands': [3, 1011, 1203, 1338, 1603],
  'nine-dragon-stack': [3, 1001, 1148, 1743, 1969],
  'open-plot-alien-plain': [2, 526, 586, 731, 860],
  'open-plot-clockwork-canyon': [2, 550, 612, 768, 900],
  'open-plot-coral-drift': [2, 552, 615, 775, 918],
  'open-plot-desert-ruin': [2, 563, 623, 785, 914],
  'open-plot-ember-forge': [2, 544, 605, 770, 908],
  'open-plot-fossil-badlands': [2, 537, 593, 759, 884],
  'open-plot-frostline-peaks': [2, 541, 606, 762, 898],
  'open-plot-jungle-ziggurat': [2, 541, 601, 758, 880],
  'open-plot-lantern-bayou': [2, 552, 613, 764, 892],
  'open-plot-mosslight-ruins': [2, 569, 633, 791, 923],
  'open-plot-night-market': [2, 566, 629, 795, 918],
  'open-plot-patchwork-fairground': [2, 531, 587, 755, 880],
  'open-plot-saltwind-lighthouse': [2, 519, 568, 730, 851],
  'open-plot-sky-harbor': [2, 538, 602, 756, 883],
  'open-plot-sky-race': [2, 539, 598, 764, 891],
  'open-plot-starfall-observatory': [2, 540, 603, 761, 892],
  'open-plot-thin-ice': [2, 547, 601, 738, 855],
  'pastel-plain': [3, 527, 599, 736, 879],
  'pine-hollow': [3, 988, 1117, 1247, 1411],
  'sunscar-dunes': [3, 703, 826, 1017, 1170],
}
const MB = 1e6
const [pinsFile, tarFolder, out] = process.argv.slice(2)
const decoder = new TextDecoder()
const zones = []
for (const pin of JSON.parse(readFileSync(pinsFile, 'utf8')).shards) {
  const reading = EM11[pin.slug]
  if (reading === undefined) continue
  const [runs, playingCentral, playingHigh, loadingCentral, loadingHigh] =
    reading
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
  `${JSON.stringify({ epoch: MEMORY_EPOCH, source: 'meta MEMORY-GATES MG6 / ENGINE-MEMORY EM11; engine test/pins/shardfiles.json', zones }, null, 1)}\n`,
)
