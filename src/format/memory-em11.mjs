/* oxlint-disable curly, id-length, import/no-nodejs-modules, no-continue, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/prefer-readonly-parameter-types, typescript/require-array-sort-compare, typescript/strict-boolean-expressions, unicorn/import-style, unicorn/no-array-sort, unicorn/no-null -- calibration tool over engine run files */
// MEMORY-GATES MG6 (mini-sweep, 2026-11-18): turn an every-zone EM11 sweep into memory-calibration.em11.json, the
// readings memory-fit.mjs and memory-calibration.golden-gen.mjs fit and pair the estimate to.
//   node src/format/memory-em11.mjs <engine checkout> <runs folder> src/format/memory-calibration.em11.json
// The runs folder holds engine `scripts/memory/measure.mjs --runs=1 --out=<zone>-<n>.json` files: cold native WebKit
// boots of every pinned zone on one engine build, rounds alternating the zone order. Each zone's figures go through the
// engine's own EM11 chain (`scripts/memory/phoneModel.mjs` and its `phone-model.json`): the central figure is the median
// run's, the upper bound the highest run's, so a bound holds for every run read. Decimal MB.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [engine, folder, out] = process.argv.slice(2)
const model = await import(
  pathToFileURL(join(engine, 'scripts/memory/phoneModel.mjs')).href
)
const phone = model.loadPhoneModel()
const MB = 1e6
const median = xs => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const byZone = new Map()
const builds = new Set()
const instruments = new Set()
const dates = []
for (const name of readdirSync(folder)
  .filter(f => f.endsWith('.json'))
  .sort()) {
  const file = JSON.parse(readFileSync(join(folder, name), 'utf8'))
  if (typeof file.date === 'string') dates.push(file.date)
  for (const run of file.webkit ?? []) {
    if (!run.ready || !run.settled || run.refused) continue
    const slug = run.chunk === '_template' ? 'template' : run.chunk
    builds.add(String(run.build).split('-')[0])
    instruments.add(run.instrument ?? 'full')
    const rows = byZone.get(slug) ?? []
    rows.push(run)
    byZone.set(slug, rows)
  }
}
if (builds.size !== 1 || instruments.size !== 1)
  throw new Error(
    `the runs mix builds (${[...builds].join(', ')}) or instruments (${[...instruments].join(', ')})`,
  )
const zones = {}
for (const [slug, runs] of [...byZone].sort(([a], [b]) => a.localeCompare(b))) {
  const playing = runs.map(r => model.phoneFromWebKit(r.settled, phone))
  const loading = runs.map(r => model.phonePeakFromWebKit(r.checkpoints, phone))
  const mb = v => Math.round(v / MB)
  zones[slug] = {
    runs: runs.length,
    playingMB: mb(median(playing.map(r => r.central))),
    playingHighMB: mb(Math.max(...playing.map(r => r.high))),
    loadingMB: mb(median(loading.map(r => r.central))),
    loadingHighMB: mb(Math.max(...loading.map(r => r.high))),
    settledWebContentMB: mb(median(runs.map(r => r.settled.webcontent))),
    settledGpuMB: mb(median(runs.map(r => r.settled.gpu))),
    peakWebContentMB: mb(
      median(
        runs.map(r => Math.max(...r.checkpoints.map(c => c.peak.webcontent))),
      ),
    ),
    peakGpuMB: mb(
      median(runs.map(r => Math.max(...r.checkpoints.map(c => c.peak.gpu)))),
    ),
  }
}
writeFileSync(
  out,
  `${JSON.stringify(
    {
      engine: [...builds][0],
      measured: dates.sort()[0]?.slice(0, 10) ?? null,
      instrument: [...instruments][0],
      model: {
        measured: phone.measured,
        alpha: phone.alpha,
        scale: phone.scale,
      },
      zones,
    },
    null,
    1,
  )}\n`,
)
