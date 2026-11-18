/* oxlint-disable curly, no-continue, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/prefer-readonly-parameter-types, unicorn/import-style, unicorn/no-null -- calibration oracle over real products */
// MEMORY-GATES MG6 (mini-estcal2, 2026-11-17, memory epoch 4): the paired table. Each pinned product's offline estimate,
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

// EM11 (mini-estcal2, 2026-11-17 23:15-23:55 Cancun): engine `scripts/memory/measure.mjs` on engine main `6b432a2a` with
// all 27 catalogue pins, Mac mini, headless Playwright WebKit, phone tier Low, cold boots (3 runs; 2 for each Open Plots
// plot), through `phone-model.json` (refit at 2048 MiB, `72e30a23`). Per zone: runs, then playing (settled) central and
// upper bound, then loading peak central and upper bound, decimal MB. The central figure is the median run's; the upper
// bound is the highest run's, so a zone's bound holds for every run read.
const EM11 = {
  template: [3, 634, 700, 827, 958],
  'brasscap-mesa': [3, 655, 727, 856, 992],
  'driftwood-isle': [3, 1042, 1165, 1234, 1434],
  'far-reach': [3, 797, 953, 1080, 1305],
  'ink-cel-valley': [3, 548, 628, 723, 870],
  'nalati-grasslands': [3, 1163, 1281, 1549, 1683],
  'nine-dragon-stack': [3, 1177, 1367, 2027, 2178],
  'open-plot-alien-plain': [2, 541, 597, 705, 836],
  'open-plot-clockwork-canyon': [2, 575, 633, 757, 893],
  'open-plot-coral-drift': [2, 585, 641, 761, 889],
  'open-plot-desert-ruin': [2, 590, 648, 792, 915],
  'open-plot-ember-forge': [2, 563, 620, 737, 871],
  'open-plot-fossil-badlands': [2, 563, 617, 733, 864],
  'open-plot-frostline-peaks': [2, 592, 651, 776, 911],
  'open-plot-jungle-ziggurat': [2, 576, 633, 752, 876],
  'open-plot-lantern-bayou': [2, 604, 668, 764, 896],
  'open-plot-mosslight-ruins': [2, 593, 658, 776, 911],
  'open-plot-night-market': [2, 599, 660, 801, 929],
  'open-plot-patchwork-fairground': [2, 559, 613, 749, 874],
  'open-plot-saltwind-lighthouse': [2, 533, 584, 696, 819],
  'open-plot-sky-harbor': [2, 565, 622, 753, 878],
  'open-plot-sky-race': [2, 564, 621, 759, 885],
  'open-plot-starfall-observatory': [2, 569, 626, 758, 883],
  'open-plot-thin-ice': [2, 568, 615, 715, 831],
  'pastel-plain': [3, 548, 617, 708, 855],
  'pine-hollow': [3, 1146, 1240, 1532, 1738],
  'sunscar-dunes': [3, 686, 830, 964, 1140],
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
  const boot = bootMemoryCosts(shard, sections, mountedImages)
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
