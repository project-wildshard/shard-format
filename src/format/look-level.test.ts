import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import {
  LookLevelSchema,
  levelLook,
  liftLevelLook,
  lookLevelRules,
} from './look-level.ts'
import { ManifestMetadataSchema } from './minimap.ts'

import type { LookLevel } from './look-level.ts'

type Rgb = [number, number, number]
const WHITE: Rgb = [1, 1, 1]
const HEMI_SKY = 10_266_548
const HEMI_GROUND = 6_316_128
const sky: LookLevel['sky'] = {
  sunColor: [1, 0.9, 0.8],
  sunIntensity: 2.5,
  envIntensity: 0.4,
  bgIntensity: 1,
  fogSunColor: [1, 0.8, 0.6],
  cloudSunColor: [1, 0.9, 0.7],
  hemiSky: HEMI_SKY,
  hemiGround: HEMI_GROUND,
  hemiIntensity: 0.7,
  sun: { azimuth: 35, elevation: 45 },
}
const atmosphere: LookLevel['atmosphere'] = {
  fogHeight: -20,
  fogHeightFalloff: 0,
  fogHeightDensity: 0,
  fogDistDensity: 0.002,
  volumetricSunColor: WHITE,
}
const grade: LookLevel['grade'] = {
  saturation: -0.1,
  brightness: 0,
  contrast: 0.05,
  bloomIntensity: 0.3,
  bloomThreshold: 0.9,
  shadowTint: WHITE,
  highTint: WHITE,
  lift: [0, 0, 0],
  gain: WHITE,
  gamma: 1,
}
const horizon: NonNullable<LookLevel['horizon']> = { rings: [], cloudSea: true }
const whole: LookLevel = { sky, atmosphere, grade, horizon }
const look: { keys: never[]; level?: LookLevel } = { keys: [] }
const BOTH =
  'look.level: the level look lives in look.level or the manifest, not both'

test('look.level takes the manifest sky, atmosphere, grade and horizon as they were', (): void => {
  expect(parse(LookLevelSchema, whole)).toEqual(whole)
  expect(safeParse(LookLevelSchema, { sky, atmosphere }).success).toBe(false)
  expect(
    safeParse(LookLevelSchema, { sky, atmosphere, grade, extra: 1 }).success,
  ).toBe(false)
})

test('a manifest built since OF9b2 carries no level look', (): void => {
  const { entries } = ManifestMetadataSchema
  expect(entries.sky.type).toBe('exact_optional')
  expect(entries.atmosphere.type).toBe('exact_optional')
  expect(entries.grade.type).toBe('exact_optional')
  expect(entries.horizon.type).toBe('exact_optional')
})

test('the door lifts an older manifest into look.level, byte for byte', (): void => {
  const old = { look, manifest: { sky, atmosphere, grade, horizon } }
  const lifted = liftLevelLook(old)
  expect(lifted.manifest).toEqual({})
  expect(lifted.look).toEqual({ keys: [], level: whole })
  expect(JSON.stringify(lifted.look.level)).toBe(JSON.stringify(whole))
  expect(levelLook(old)).toEqual(whole)
  expect(lookLevelRules(lifted)).toEqual([])
  expect(lookLevelRules(old)).toEqual([])
})

test('the look wins, and a lifted or plain source comes back as it is', (): void => {
  const own: LookLevel = { sky: { ...sky, sunIntensity: 9 }, atmosphere, grade }
  const both = { look: { ...look, level: own }, manifest: { sky, atmosphere } }
  expect(liftLevelLook(both).look.level).toBe(own)
  expect(lookLevelRules(both)).toEqual([BOTH])
  const lifted = { look: { ...look, level: own }, manifest: {} }
  expect(liftLevelLook(lifted)).toBe(lifted)
  const plain = { look }
  expect(liftLevelLook(plain)).toBe(plain)
  expect(levelLook(plain)).toBeUndefined()
  expect(lookLevelRules(plain)).toEqual([])
})

test('a manifest with no whole level look anywhere is refused', (): void => {
  expect(lookLevelRules({ look, manifest: {} })).toHaveLength(1)
  expect(lookLevelRules({ look, manifest: { sky, atmosphere } })).toHaveLength(
    1,
  )
})
