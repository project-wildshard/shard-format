/* oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-parameters, unicorn/max-nested-calls, eslint/sort-vars, unicorn/no-null, eslint/prefer-destructuring, eslint/curly, eslint/id-length, eslint/max-statements, eslint/capitalized-comments -- Reads committed corpus JSON as plain records, like a reviewer would. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { ROOT } from '../test/helpers/corpus.ts'

// BM-5 (meta TEMPLATE-E2E-PLAN): the Dust Wyrm, Brasscap Mesa's boss, on TE-ENG1's rows. Its decision raises the
// tell field with a sand-ring burst, then opens the gullet field and lets rounds land (guard 3) for a window; outside
// it the guard is 1 and nothing lands. The decision and the particle script are compiled once and ship raw.

const BRASSCAP = path.join(ROOT, 'corpus/exports/brasscap-mesa')
/** The canyon GLB's `wyrm` empty at the pinned commit (shard-brasscap tools/canyon.ts). */
const PIT: Vec = [2, 0, -100]
/** The `attack` clip's span in the Wyrm's generator (shard-brasscap tools/wyrm.ts). */
const ATTACK_SPAN = 1.5
const TELL = 110
const GULLET = 111
const PARTS = 'the tell, the windup and the rise-and-burst clip line up'

type Vec = readonly number[]
interface Spawn {
  readonly id: string
  readonly at: Vec
  readonly brain: string | null
  readonly strike: string | null
  readonly species: string
  readonly variant: string
  readonly scale: number
}
interface Species {
  readonly id: string
  readonly variants: readonly { readonly id: string; readonly hp: number }[]
}
interface Strike {
  readonly id: string
  readonly windup: number
  readonly active: number
  readonly recover: number
  readonly shape: { readonly radius: number }
}
interface Encounter {
  readonly id: string
  readonly entity: string
  readonly kind: string
  readonly panel: string | null
}
interface Ui {
  readonly kind: string
  readonly id?: string
  readonly encounter?: string
}
interface Field {
  readonly id: number
  readonly name: string
  readonly privacy: string
}
interface Decision {
  readonly binding: { readonly encounter?: string }
  readonly actors: Readonly<Record<string, string>>
  readonly strikes: Readonly<Record<string, string>>
  readonly fields: Readonly<Record<string, string>>
  readonly source: string
  readonly sourceHash: string
  readonly module: string
  readonly params: Readonly<Record<string, number>>
}
interface Binding {
  readonly name: string
  readonly module: string
  readonly reads: readonly { readonly id: number }[]
  readonly target: { readonly kind: string; readonly at: Vec }
}
interface Look {
  readonly species: string
  readonly recipe: string
  readonly parameters: { readonly skin?: string }
  readonly animation: { readonly parameters: { readonly attackSpan?: number } }
}
interface Index {
  readonly admission: {
    readonly critical: readonly string[]
    readonly library: readonly string[]
  }
}

function read<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(BRASSCAP, file), 'utf8')) as T
}
const sha256 = (bytes: Readonly<Uint8Array>): string =>
  createHash('sha256').update(bytes).digest('hex')
const spawns = (): readonly Spawn[] =>
  read<{ readonly creatures: { readonly spawns: readonly Spawn[] } }>(
    'sections/actors/creatures.json',
  ).creatures.spawns
const strikes = (): readonly Strike[] =>
  read<{ readonly rows: { readonly strikes: readonly Strike[] } }>(
    'sections/combat/strikes.json',
  ).rows.strikes
const encounters = (): readonly Encounter[] =>
  read<{ readonly encounters: readonly Encounter[] }>(
    'sections/combat/encounters.json',
  ).encounters
const shared = (): readonly Field[] =>
  read<{ readonly state: { readonly shared: readonly Field[] } }>(
    'sections/state/state.json',
  ).state.shared
const index = (): Index => read<Index>('shard.json')

function wyrm(): Spawn {
  const row = spawns().find((spawn: Spawn): boolean => spawn.id === 'dust-wyrm')
  assert.ok(row)
  return row
}
function burst(): Strike {
  const row = strikes().find(
    (strike: Strike): boolean => strike.id === wyrm().strike,
  )
  assert.ok(row)
  return row
}
function field(id: number): Field {
  const row = shared().find((candidate: Field): boolean => candidate.id === id)
  assert.ok(row)
  return row
}

test('BM-5: the Wyrm stands in its pit, a boss with a burst strike and a boss panel', (): void => {
  const row = wyrm(),
    [x, , z] = PIT
  assert.deepEqual([row.at[0], row.at[2]], [x, z])
  assert.equal(row.brain, null)
  assert.equal(row.strike, 'brasscap.wyrm.burst')
  const species = read<{
    readonly rows: { readonly species: readonly Species[] }
  }>('sections/actors/species.json').rows.species.find(
    (candidate: Species): boolean => candidate.id === row.species,
  )
  assert.equal(
    species?.variants.find(
      (variant: Species['variants'][number]): boolean =>
        variant.id === row.variant,
    )?.hp,
    80,
  )
  // The tell lasts the burst's windup, which is when engine plays the `attack` clip (rise, then the slam)
  const [decision] = read<readonly Decision[]>('sections/sim/scripts.json')
  assert.equal(decision?.params['windup'], burst().windup, PARTS)
  const fight = encounters().find(
    (candidate: Encounter): boolean => candidate.entity === row.id,
  )
  assert.equal(fight?.kind, 'boss')
  const ui = read<{ readonly ui: readonly Ui[] }>('sections/ui/ui.json').ui
  assert.ok(
    ui.some(
      (panel: Ui): boolean =>
        panel.kind === 'bossPanel' &&
        panel.id === fight.panel &&
        panel.encounter === fight.id,
    ),
  )
})

test('BM-5: the decision ships compiled from wyrm.as, and gates rounds to the open window', (): void => {
  const [row] = read<readonly Decision[]>('sections/sim/scripts.json')
  assert.ok(row)
  assert.equal(row.binding.encounter, encounters()[0]?.id)
  assert.deepEqual(row.actors, { boss: 'dust-wyrm' })
  assert.deepEqual(row.strikes, { burst: 'brasscap.wyrm.burst' })
  assert.equal(row.fields['tell'], field(TELL).name)
  assert.equal(row.fields['gullet'], field(GULLET).name)
  for (const id of [TELL, GULLET]) assert.equal(field(id).privacy, 'public')
  assert.match(row.sourceHash, /^[\da-f]{64}$/u)
  const bytes = readFileSync(path.join(BRASSCAP, row.module))
  assert.equal(`blobs/wasm/${sha256(bytes)}.wasm`, row.module)
  assert.ok(index().admission.critical.includes(sha256(bytes)))
  // wyrm.as's guard 3 (rounds only) as the gullet opens, 1 (none) as it shuts and while the burst rears: shard-brasscap
  // holds the source and its text checks now; this export holds the compiled module only.
})

test('BM-5: sand-ring particles circle the burst reach on the tell field, the gullet glow on the open field', (): void => {
  const { bindings } = read<{
      readonly clientScripts: { readonly bindings: readonly Binding[] }
    }>('sections/sim/client-scripts.json').clientScripts,
    row = wyrm(),
    reach = burst().shape.radius * row.scale
  const ring = bindings.filter(
      (binding: Binding): boolean => binding.reads[0]?.id === TELL,
    ),
    glow = bindings.filter(
      (binding: Binding): boolean => binding.reads[0]?.id === GULLET,
    )
  assert.equal(ring.length, 12)
  for (const binding of ring) {
    const away = Math.hypot(
      (binding.target.at[0] ?? 0) - (row.at[0] ?? 0),
      (binding.target.at[2] ?? 0) - (row.at[2] ?? 0),
    )
    assert.ok(Math.abs(away - reach) < 0.4, `${binding.name} at ${away}`)
  }
  assert.equal(glow.length, 1)
  const module = bindings[0]?.module ?? ''
  assert.equal(
    sha256(readFileSync(path.join(BRASSCAP, 'blobs/wasm', `${module}.wasm`))),
    module,
  )
  assert.ok(
    bindings.every(
      (binding: Binding): boolean =>
        binding.module === module && binding.target.kind === 'particles',
    ),
  )
})

test('BM-5: the Wyrm draws as its generated skin, with the attack span its clip runs', (): void => {
  const look = read<{ readonly rows: { readonly looks: readonly Look[] } }>(
      'sections/look/materials.json',
    ).rows.looks.find(
      (candidate: Look): boolean => candidate.species === wyrm().species,
    ),
    skin = look?.parameters.skin ?? ''
  assert.equal(look?.recipe, 'platform.skin')
  assert.equal(look.animation.parameters.attackSpan, ATTACK_SPAN)
  const skinBytes = readFileSync(
      path.join(BRASSCAP, 'blobs/json', `${skin}.json`),
    ),
    glb = (
      JSON.parse(skinBytes.toString()) as {
        readonly row: { readonly file: string }
      }
    ).row.file
  assert.equal(sha256(skinBytes), skin)
  assert.equal(
    sha256(readFileSync(path.join(BRASSCAP, 'blobs/glb', `${glb}.glb`))),
    glb,
  )
  const { library } = index().admission
  assert.ok(library.includes(glb) && library.includes(skin))
})
