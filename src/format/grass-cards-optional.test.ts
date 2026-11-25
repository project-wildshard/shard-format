import { parse, safeParse } from 'valibot'
import { describe, expect, it } from 'vitest'

import {
  GrassPresentationSchema,
  grassPresentationFiles,
} from './fieldPresentation.ts'

// QA 11-24 row 70 (J510: no flat image stands in for a 3D object): Nalati's grass dropped its card clumps, so the
// presentation may omit them, all together; a half-dropped set is refused.
interface Variant {
  readonly tierCards: boolean
  readonly phoneScene: boolean
  readonly thirdLook: boolean
  readonly height: boolean
}
const ALL: Variant = {
  tierCards: true,
  phoneScene: true,
  thirdLook: true,
  height: true,
}
const NONE: Variant = {
  tierCards: false,
  phoneScene: false,
  thirdLook: false,
  height: false,
}
const file = (name: string): { file: string } => ({ file: name })
const cell = (size: number, across: number): Record<string, number> =>
  Object.fromEntries([
    ['T', size],
    ['G', across],
  ])
const spacing = (size: number, step: number): Record<string, number> =>
  Object.fromEntries([
    ['T', size],
    ['s', step],
  ])
const tier = (
  name: string,
  cards: boolean,
  scene: boolean,
): Record<string, unknown> => ({
  rings: [cell(4, 8)],
  flowers: cell(8, 10),
  near: [2.3, 3.4],
  per: 10,
  ...(cards ? { cards: spacing(2, 0.2) } : {}),
  scenes: {
    blades: file(`${name}-blades`),
    flowers: file(`${name}-flowers`),
    ...(scene ? { cards: file(`${name}-cards`) } : {}),
  },
})
const rows = (variant: Variant): Record<string, unknown> => ({
  height: file('height'),
  mask: file('mask'),
  field: file('field'),
  ground: file('ground'),
  phone: tier('phone', variant.tierCards, variant.phoneScene),
  desktop: tier('desktop', variant.tierCards, variant.tierCards),
  view: {
    looks: variant.thirdLook
      ? ['blades', 'flowers', 'cards']
      : ['blades', 'flowers'],
    half: 250,
    heightSize: 512,
    heightOrigin: -256,
    lattice: 4,
    gain: 1.8,
    playerRadius: 0.55,
    ...(variant.height ? { cardsHeight: 6 } : {}),
    ringHeight: 0.9,
    trail: { speedLimit: 30, strength: 1 },
    gainFalloff: [0.18, 0.5, 1],
    saturationFalloff: [0.2, 0.5, 1],
    tintNight: [0.5, 0.6, 1],
    tintStorm: [0.6, 0.6, 0.7],
  },
})

describe('grass cards are optional, all or none', (): void => {
  it('admits grass with its cards, as before', (): void => {
    const parsed = parse(GrassPresentationSchema, rows(ALL))
    expect(grassPresentationFiles(parsed, 'phone')).toContain('phone-cards')
  })
  it('admits grass without cards and asks for no card file', (): void => {
    const parsed = parse(GrassPresentationSchema, rows(NONE))
    expect(parsed.view.looks).toEqual(['blades', 'flowers'])
    expect(
      grassPresentationFiles(parsed).filter((name: string): boolean =>
        name.endsWith('-cards'),
      ),
    ).toEqual([])
  })
  it('refuses a half-dropped set', (): void => {
    for (const half of [
      { ...ALL, phoneScene: false },
      { ...ALL, thirdLook: false },
      { ...NONE, height: true },
      { ...NONE, tierCards: true },
    ]) {
      expect(safeParse(GrassPresentationSchema, rows(half)).success).toBe(false)
    }
  })
})
