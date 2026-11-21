/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, unicorn/consistent-function-scoping -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4f1 (Q35): the headless section list, the road light and the mover rest pose are format laws.
// small-laws.golden.json was answered by the engine's own code (small-laws.golden-gen.mjs) over
// small-laws.golden-specs.ts, so this proves format's copies give the same answers.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  HEADLESS_CONTEXT_SECTIONS,
  headlessSections,
  productHeadlessSections,
} from './headless-sections.ts'
import { moverChannelValues } from './mover-pose.ts'
import { FAR_CLIFF_FLOOR, ROAD_SKY } from './road-light.ts'
import {
  MOVER_CASES,
  SECTION_INPUTS,
  answer,
} from './small-laws.golden-specs.ts'

interface Golden {
  readonly sectionNames: readonly string[]
  readonly sections: readonly unknown[]
  readonly roadSky: unknown
  readonly farCliffFloor: number
  readonly mover: readonly unknown[]
}
const golden = JSON.parse(
  readFileSync(new URL('small-laws.golden.json', import.meta.url), 'utf8'),
) as Golden

describe('small laws match the engine', () => {
  it('lists the same headless sections and admits the same products', () => {
    expect(HEADLESS_CONTEXT_SECTIONS).toEqual([
      ...golden.sectionNames.slice(0, 8),
      'world/vehicles',
      ...golden.sectionNames.slice(8),
      'client/plan',
    ])
    const product = (
      pairs: readonly (readonly [string, unknown])[],
    ): {
      has: (name: string) => boolean
      section: (name: string) => unknown
    } => ({
      has: name => pairs.some(([key]) => key === name),
      section: name => pairs.find(([key]) => key === name)?.[1],
    })
    expect(
      SECTION_INPUTS.map(pairs => [
        answer(() => headlessSections(new Map(pairs))),
        answer(() => productHeadlessSections(product(pairs))),
      ]),
    ).toEqual(golden.sections)
  })
  it('adopts the client plan that declares the portal ride for headless proof', () => {
    const plan = { version: 1, features: [{ kind: 'strings.register' }] }
    expect(
      headlessSections(new Map([['client/plan', plan]])).get('client/plan'),
    ).toEqual(plan)
  })
  it('lights the road and the far cliffs the same', () => {
    expect(ROAD_SKY).toEqual(golden.roadSky)
    expect(FAR_CLIFF_FLOOR).toBe(golden.farCliffFloor)
  })
  it('copies the same mover observations', () => {
    expect(
      MOVER_CASES.map(c =>
        answer(() => moverChannelValues(c.reads, c.pose, c.fields)),
      ),
    ).toEqual(golden.mover)
  })
})
