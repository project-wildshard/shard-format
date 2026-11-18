/* oxlint-disable capitalized-comments, curly, id-length, import/no-nodejs-modules, max-lines-per-function, max-statements, no-console, no-continue, no-magic-numbers, no-plusplus, no-use-before-define, node/no-sync, prefer-named-capture-group, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/consistent-existence-index-check, unicorn/consistent-function-scoping, unicorn/no-array-for-each, unicorn/no-array-reduce, unicorn/no-null -- calibration tool over the paired table */
// MEMORY-GATES MG6 (mini-sweep, 2026-11-18, memory epoch 6): fit the offline estimate's phone weights (`PHONE` in
// boot-memory-cost.ts) to an EM11 sweep, so the estimate follows the engine it is read against. The estimate is
// engine + weights x a product's terms; the terms depend only on the product, while the engine term and every weight
// are what one engine build does with those bytes. An engine cut therefore moves the estimate only through a refit:
// sweep every pinned zone on the new engine (engine `scripts/memory/measure.mjs`, then this repo's
// `memory-calibration.em11.json`), run this, paste its block into `PHONE`, bump MEMORY_EPOCH and regenerate the golden:
//   node src/format/memory-fit.mjs src/format/memory-calibration.golden.json src/format/memory-calibration.em11.json [--exempt=loading:pine-hollow]
// Per phase: minimax of estimate / EM11 upper bound over every zone, with every estimate at or over its bound, the
// content weight held at 0.5 settled and 0.8 loading at least (bytes a boot downloads and decodes always count), and
// each zone's verdict at the 1.0 GB playing envelope or the 1.5 GB loading line kept as EM11's unless exempted; then,
// at that ratio, the least total overshoot. A runtime home's reading branch (`PHONE.runtime`) is fixed, not fitted.
import { readFileSync } from 'node:fs'

const MB = 1e6
const LINES = { playing: 1000, loading: 1500 }
const CONTENT_FLOOR = { playing: 0.5, loading: 0.8 }
const RUNTIME = { playing: 1, loading: 1.26 }
const EPS = 1e-9
/** A kept verdict holds this far under its line, so rounding the weights cannot carry a zone over it (MB). */
const VERDICT_MARGIN = 0.05

/** Minimise c.x over x >= 0 under rows [a, op, b] (op '<=' or '>='): a dense two-phase simplex, Bland's rule.
 *  Returns x, or null when infeasible. */
function lp(c, rows) {
  const n = c.length
  const norm = rows.map(([a, op, b]) =>
    b < 0 ? [a.map(v => -v), op === '<=' ? '>=' : '<=', -b] : [a, op, b],
  )
  const m = norm.length
  const slack = norm.length
  const arts = norm.filter(([, op]) => op === '>=').length
  const width = n + slack + arts + 1
  const t = []
  const basis = []
  let art = n + slack
  norm.forEach(([a, op, b], i) => {
    const row = Array.from({ length: width }, () => 0)
    a.forEach((v, j) => {
      row[j] = v
    })
    row[n + i] = op === '<=' ? 1 : -1
    if (op === '>=') {
      row[art] = 1
      basis.push(art)
      art += 1
    } else basis.push(n + i)
    row[width - 1] = b
    t.push(row)
  })
  const pivot = (r, col) => {
    const p = t[r][col]
    for (let j = 0; j < width; j++) t[r][j] /= p
    for (let i = 0; i < m; i++)
      if (i !== r && Math.abs(t[i][col]) > EPS) {
        const f = t[i][col]
        for (let j = 0; j < width; j++) t[i][j] -= f * t[r][j]
      }
    basis[r] = col
  }
  const run = (cost, allowed) => {
    for (let iter = 0; iter < 5000; iter++) {
      // reduced costs
      let enter = -1
      for (let j = 0; j < width - 1 && enter < 0; j++) {
        if (!allowed(j) || basis.includes(j)) continue
        let rc = cost[j] ?? 0
        for (let i = 0; i < m; i++) rc -= (cost[basis[i]] ?? 0) * t[i][j]
        if (rc < -EPS) enter = j
      }
      if (enter < 0) return true
      let leave = -1
      let best = Infinity
      for (let i = 0; i < m; i++)
        if (t[i][enter] > EPS) {
          const ratio = t[i][width - 1] / t[i][enter]
          if (
            ratio < best - EPS ||
            (Math.abs(ratio - best) <= EPS && basis[i] < basis[leave])
          ) {
            best = ratio
            leave = i
          }
        }
      if (leave < 0) return false
      pivot(leave, enter)
    }
    return false
  }
  if (arts > 0) {
    const phase1 = Array.from({ length: width - 1 }, (_, j) =>
      j >= n + slack ? 1 : 0,
    )
    run(phase1, () => true)
    const infeasible = basis.some(
      (b, i) => b >= n + slack && t[i][width - 1] > 1e-7,
    )
    if (infeasible) return null
    // drive any zero artificial out of the basis
    basis.forEach((b, i) => {
      if (b < n + slack) return
      const col = t[i].findIndex((v, j) => j < n + slack && Math.abs(v) > EPS)
      if (col >= 0) pivot(i, col)
    })
  }
  if (!run(c, j => j < n + slack)) return null
  const x = Array.from({ length: n }, () => 0)
  basis.forEach((b, i) => {
    if (b < n) x[b] = t[i][width - 1]
  })
  return x
}

const KEYS = ['engine', 'content', 'textures', 'gl', 'geometry']

/** One phase's fit. zones: { slug, terms (MB), high (MB) }. */
function fitPhase(phase, zones, exempt) {
  const floor = CONTENT_FLOOR[phase]
  // x = [engine, content - floor, textures, gl, geometry]; fixed part per zone = floor x content + sims
  const coeff = z => [
    1,
    z.terms.content,
    z.terms.textures,
    z.terms.gl,
    z.terms.geometry,
  ]
  const fixed = z => floor * z.terms.content + z.terms.sims
  const runtime = z => RUNTIME[phase] * z.terms.runtimeReading
  const rowsAt = ratio => {
    const rows = []
    for (const z of zones) {
      if (runtime(z) < z.high) rows.push([coeff(z), '>=', z.high - fixed(z)])
      rows.push([coeff(z), '<=', ratio * z.high - fixed(z)])
      if (z.high <= LINES[phase] && !exempt.has(z.slug))
        rows.push([coeff(z), '<=', LINES[phase] - VERDICT_MARGIN - fixed(z)])
    }
    return rows
  }
  const zero = [0, 0, 0, 0, 0]
  let lo = 1
  let hi = 3
  if (lp(zero, rowsAt(hi)) === null)
    throw new Error(
      `${phase}: no fit under 3x, or a verdict cannot be kept (try --exempt)`,
    )
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (lp(zero, rowsAt(mid)) === null) lo = mid
    else hi = mid
  }
  const ratio = Math.ceil(hi * 1000) / 1000
  // least total overshoot at that ratio: minimise the sum of the linear estimates
  const total = zones.reduce(
    (sum, z) => sum.map((v, j) => v + coeff(z)[j]),
    zero,
  )
  const x = lp(total, rowsAt(ratio))
  const w = Object.fromEntries(
    KEYS.map((k, j) => [k, Math.round(x[j] * 1e4) / 1e4]),
  )
  w.content = Math.round((w.content + floor) * 1e4) / 1e4
  // the weights are rounded for the source, so the engine term is re-derived: the least that keeps every zone at or
  // over its bound, in whole kB
  w.engine = 0
  for (const z of zones)
    if (runtime(z) < z.high)
      w.engine = Math.max(
        w.engine,
        z.high -
          (w.content * z.terms.content +
            w.textures * z.terms.textures +
            w.gl * z.terms.gl +
            w.geometry * z.terms.geometry +
            z.terms.sims),
      )
  w.engine = Math.ceil(w.engine * 1000) / 1000
  for (const z of zones)
    if (
      z.high <= LINES[phase] &&
      !exempt.has(z.slug) &&
      estimate(phase, w, z.terms) > LINES[phase]
    )
      throw new Error(
        `${phase}: rounding put ${z.slug} over the line; refit by hand`,
      )
  return { ratio, w }
}

function estimate(phase, w, terms) {
  return Math.max(
    w.engine +
      w.content * terms.content +
      w.textures * terms.textures +
      w.gl * terms.gl +
      w.geometry * terms.geometry +
      terms.sims,
    RUNTIME[phase] * terms.runtimeReading,
  )
}

const [goldenFile, em11File, ...flags] = process.argv.slice(2)
const exemptions = { playing: new Set(), loading: new Set() }
for (const flag of flags) {
  const m = /^--exempt=(playing|loading):(.+)$/u.exec(flag)
  if (m) for (const slug of m[2].split(',')) exemptions[m[1]].add(slug)
}
const golden = JSON.parse(readFileSync(goldenFile, 'utf8'))
const sweep = JSON.parse(readFileSync(em11File, 'utf8'))
const zones = { playing: [], loading: [] }
for (const zone of golden.zones) {
  const em = sweep.zones[zone.slug]
  if (em === undefined)
    throw new Error(`${zone.slug}: no EM11 reading in ${em11File}`)
  const terms = Object.fromEntries(
    Object.entries(zone.terms).map(([k, v]) => [k, v / MB]),
  )
  zones.playing.push({ slug: zone.slug, terms, high: em.playingHighMB })
  zones.loading.push({ slug: zone.slug, terms, high: em.loadingHighMB })
}
const fit = {}
for (const phase of ['playing', 'loading'])
  fit[phase] = fitPhase(phase, zones[phase], exemptions[phase])
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d
console.log(
  `engine ${sweep.engine} (${sweep.measured}, ${sweep.instrument}); ratio playing ${fit.playing.ratio}, loading ${fit.loading.ratio}`,
)
console.log('| zone | playing est / EM11 upper | loading est / EM11 upper |')
for (let i = 0; i < zones.playing.length; i++) {
  const p = zones.playing[i]
  const l = zones.loading[i]
  const ep = estimate('playing', fit.playing.w, p.terms)
  const el = Math.max(ep, estimate('loading', fit.loading.w, l.terms))
  console.log(
    `| ${p.slug} | ${ep.toFixed(0)} / ${p.high} (${(ep / p.high).toFixed(2)}) | ${el.toFixed(0)} / ${l.high} (${(el / l.high).toFixed(2)}) |`,
  )
}
console.log('PHONE = {')
console.log(
  `  engine: { playing: ${Math.ceil(fit.playing.w.engine * 1000) * 1000}, loading: ${Math.ceil(fit.loading.w.engine * 1000) * 1000} },`,
)
for (const k of KEYS.slice(1))
  console.log(
    `  ${k}: { playing: ${round(fit.playing.w[k], 4)}, loading: ${round(fit.loading.w[k], 4)} },`,
  )
console.log('}')
