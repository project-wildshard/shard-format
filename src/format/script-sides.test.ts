// oxlint-disable typescript/prefer-readonly-parameter-types -- test rows are only read
import { safeParse } from 'valibot'
import { describe, expect, test } from 'vitest'

import { DecisionScriptsSchema } from './decisionScripts.ts'
import {
  PAGE_ONLY_PROGRAM_HOSTS,
  SCRIPT_V1_FEATURE_SIDES,
  SCRIPT_V1_VIEW_COMMANDS,
  SCRIPT_V2_LANE_SIDES,
  pageOnlyHostSides,
  scriptSideRefusals,
} from './script-sides.ts'

import type { NamedJson } from './script-sides.ts'

// SERVER-PARITY SS7: v1 rows declare `sim` or `view`; a view row writes no gameplay, a sim row a page-only feature
// runs is refused, and v1 sides and v2 lanes map onto SS2's side words. The grandfather list and the built products
// are in `script-side-grandfather.test.ts`.

type Json = Record<string, unknown>

const LIFE = 'actors/page-life.json'
const COPY_LINE = `page.life program x.life (${LIFE}) is not its actors/return-scripts row`
const GAMEPLAY = ['flag', 'reward', 'spawn', 'grant', 'signal', 'field', 'move']

/** A v1 row that passes every row rule, with `changes` applied. */
function scriptRow(changes: Json = {}): Json {
  return {
    abi: '1.0',
    binding: { shard: true },
    commands: ['channel'],
    id: 'x.life',
    module: `blobs/wasm/${'a'.repeat(64)}.wasm`,
    on: ['signal'],
    onFail: 'hold',
    params: {},
    reads: ['field'],
    side: 'sim',
    source: 'behaviour/row.as',
    state: [],
    stateVersion: 1,
    ...changes,
  }
}

function admitted(changes: Json): boolean {
  return safeParse(DecisionScriptsSchema, [scriptRow(changes)]).success
}

function nothing(): unknown {
  return undefined
}

/** A page.life feature whose return-scripts row is `row` and whose file carries `copy`: its sections and reader. */
function lifeProduct(
  row: Json,
  copy: Json,
): [ReadonlyMap<string, unknown>, NamedJson] {
  const sections = new Map<string, unknown>([
    ['actors/return-scripts', [row]],
    [
      'client/plan',
      { features: [{ file: LIFE, kind: 'page.life', ranged: 'r' }] },
    ],
  ])
  const named: NamedJson = (name: string): unknown =>
    name === LIFE ? { program: { script: copy } } : undefined
  return [sections, named]
}

/** The refusals for a page.life feature whose return-scripts row declares `side` and whose file carries `copy`. */
function lifeRefusals(side: string, copy: Json): string[] {
  return scriptSideRefusals(...lifeProduct(scriptRow({ side }), copy))
}

describe('v1 side', (): void => {
  test('admits sim and view, and nothing else', (): void => {
    expect([
      admitted({}),
      admitted({ side: 'view' }),
      admitted({ side: 'both' }),
    ]).toEqual([true, true, false])
  })

  test('refuses a view row that writes gameplay, and admits the same commands on sim', (): void => {
    for (const command of GAMEPLAY) {
      const commands = ['channel', command]
      expect([
        admitted({ commands, side: 'view' }),
        admitted({ commands }),
      ]).toEqual([false, true])
    }
    expect(
      admitted({ commands: [...SCRIPT_V1_VIEW_COMMANDS], side: 'view' }),
    ).toBe(true)
  })

  test('maps v1 sides and v2 lanes onto the side table words', (): void => {
    expect(SCRIPT_V1_FEATURE_SIDES).toEqual({ sim: 'both', view: 'view' })
    expect(SCRIPT_V2_LANE_SIDES).toEqual({
      project: 'both',
      sim: 'server',
      view: 'view',
    })
  })
})

describe('scriptSideRefusals', (): void => {
  test('every page-only host is a view feature in the side table', (): void => {
    expect(PAGE_ONLY_PROGRAM_HOSTS.size).toBeGreaterThan(0)
    expect([...new Set(pageOnlyHostSides().values())]).toEqual(['view'])
  })

  test('refuses a sim script page.life runs, and admits a view one', (): void => {
    expect(lifeRefusals('sim', scriptRow())).toEqual([
      `sim script x.life runs in page-only feature page.life (${LIFE}), which no server host runs`,
    ])
    expect(lifeRefusals('view', scriptRow({ side: 'view' }))).toEqual([])
  })

  test('refuses a page.life copy that is not its admitted return row', (): void => {
    expect(lifeRefusals('sim', scriptRow({ side: 'view' }))).toEqual([
      COPY_LINE,
    ])
    expect(
      lifeRefusals('view', scriptRow({ commands: ['flag'], side: 'view' })),
    ).toEqual([COPY_LINE])
  })

  test('leaves a page.life file with no program, and refuses a view row in sim/scripts', (): void => {
    const sections = new Map<string, unknown>([
      [
        'client/plan',
        { features: [{ file: LIFE, kind: 'page.life', ranged: 'r' }] },
      ],
      [
        'sim/scripts',
        [scriptRow({ id: 'a.sim' }), scriptRow({ id: 'b.view', side: 'view' })],
      ],
    ])
    expect(scriptSideRefusals(sections, nothing)).toEqual([
      "view script b.view is in sim/scripts, which only the server's decision host runs",
    ])
  })
})
