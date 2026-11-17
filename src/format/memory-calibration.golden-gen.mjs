/* oxlint-disable curly, no-continue, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/strict-boolean-expressions, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/prefer-readonly-parameter-types, unicorn/import-style, unicorn/no-null -- calibration oracle over real products */
// MEMORY-GATES MG6 (mini-estcal, 2026-11-17): the paired table. Each pinned product's offline estimate, its terms, and
// the phone peak the phone-tier probe measured for it (meta MEMORY-GATES MG11). Regenerate after any model change (the
// change bumps MEMORY_EPOCH, which memory-calibration.test.ts holds this file to):
//   node src/format/memory-calibration.golden-gen.mjs <engine>/test/pins/shardfiles.json <pinned tar folder> src/format/memory-calibration.golden.json
// The tar folder is engine's pin cache (`~/.cache/wildshard/pins`, `<hash>.tar`). It refuses to write a zone whose
// estimate falls under its measured peak.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  bootMemoryCosts,
  mountedImageBytes,
  RENDERER_FLOOR_BYTES,
} from './boot-memory-cost.ts'
import { worstContentCost } from './budget.ts'
import { MEMORY_EPOCH } from './memory-epoch.ts'
import { runtimeOfflineBytes } from './memory-line.ts'
import { assembleOutputShardfile, parseOutputIndex } from './outputIndex.ts'
import { mountSharesBlob } from './shardfile-reads.ts'
import { readTar } from './tar.ts'

// MG11 (mini-zonemem, 2026-11-17 17:04-18:00 Cancun): `wildshard memory` (sharddev 2b43e27, engine probe 3cd2dd87, v0.1.36
// preparation client), headless phone tier on Low, the larger of 2 runs: loading renderer peak x2.0, decimal MB. Open Plots
// was read as a range over its 17 plots (299-398 MB renderer); each plot is held to the range's top.
const MEASURED = {
  'nine-dragon-stack': 1997,
  'pine-hollow': 2076,
  'nalati-grasslands': 2239,
  'driftwood-isle': 1604,
  'far-reach': 1133,
  'sunscar-dunes': 966,
  'brasscap-mesa': 925,
  template: 848,
  'ink-cel-valley': 737,
  'pastel-plain': 805,
}
const OPEN_PLOTS_TOP = 796
const [pinsFile, tarFolder, out] = process.argv.slice(2)
const decoder = new TextDecoder()
const zones = []
for (const pin of JSON.parse(readFileSync(pinsFile, 'utf8')).shards) {
  const measuredMB =
    MEASURED[pin.slug] ??
    (pin.slug.startsWith('open-plot-') ? OPEN_PLOTS_TOP : undefined)
  if (measuredMB === undefined) continue
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
  const resident = worstContentCost(shard, {
    commons,
    boot: { ...boot, phoneFloor: 0 },
  })
  const zone = {
    slug: pin.slug,
    revision: pin.revision,
    tar: pin.hash,
    measuredMB,
    loading: estimate.loading,
    playing: estimate.playing,
    residentLoading: resident.loading,
    rendererContent: boot.renderer - RENDERER_FLOOR_BYTES,
    mountedImages,
    runtimeReading: boot.runtimeReading,
  }
  if (zone.loading < measuredMB * 1e6)
    throw new Error(
      `${pin.slug}: estimate ${zone.loading} under its measured ${measuredMB} MB phone peak`,
    )
  zones.push(zone)
}
writeFileSync(
  out,
  `${JSON.stringify({ epoch: MEMORY_EPOCH, source: 'meta MEMORY-GATES MG6 / MG11; engine test/pins/shardfiles.json', zones }, null, 1)}\n`,
)
