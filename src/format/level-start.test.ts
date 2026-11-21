import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { parseAudioData } from './audio.ts'
import { parseItems } from './items.ts'
import {
  DEFAULT_SPAWN,
  levelStart,
  levelStartRules,
  liftLevelStart,
  manifestCarriesStart,
} from './level-start.ts'
import { ManifestMetadataSchema } from './minimap.ts'

import type { LevelStartSource } from './level-start.ts'

const audio = { ambience: 'forest', score: 'pine', alertOnlyHostile: true }
const loadout = { weapons: ['weapon.crossbow'], tools: ['tool.hoverboard'], start: ['tool.hoverboard'], held: 'weapon.crossbow' }
const items = { version: 1 as const, rows: [], contexts: [], loadout: { primary: null, secondary: null, tools: [] } }
const empty = { cues: [], ambience: null, score: 'silent' as const }
const SET = { x: 4, y: 7, z: -3, yaw: 1 }

function source(manifest: LevelStartSource['manifest'], spawn = DEFAULT_SPAWN): LevelStartSource {
  return { spawn, audio: parseAudioData(empty), items: parseItems(items), ...(manifest === undefined ? {} : { manifest }) }
}

test('OF9b3: the sections carry the manifest audio and loadout as they were', (): void => {
  expect(parseAudioData({ ...empty, level: audio }).level).toEqual(audio)
  expect(parseItems({ ...items, loadout: { ...items.loadout, level: loadout } }).loadout.level).toEqual(loadout)
  expect(() => parseAudioData({ ...empty, level: { ambience: 'forest' } })).toThrow()
  // a manifest with none of the five still validates; an older one with all five does too
  const { entries } = ManifestMetadataSchema
  expect([entries.spawn.type, entries.weapon.type, entries.audio.type]).toEqual(['exact_optional', 'exact_optional', 'exact_optional'])
  expect(parse(entries.minimap, {})).toEqual({})
  expect(parse(entries.minimap, { image: '/assets/map.png' })).toEqual({ image: '/assets/map.png' })
})

test('OF9b3: an older manifest lifts into the sections at the door, byte for byte', (): void => {
  const manifest = { spawn: { x: 1, z: 2, yaw: 3 }, loadout, audio, weapon: 'crossbow' as const, minimap: { image: 'm.png', outside: 'sea' }, name: 'Pine' }
  const older = source(manifest)
  expect(manifestCarriesStart(manifest)).toBe(true)
  const lifted = liftLevelStart(older)
  expect(lifted.manifest).toEqual({ minimap: { outside: 'sea' }, name: 'Pine' })
  expect(lifted.spawn).toEqual({ x: 1, y: 2, z: 2, yaw: 3 })
  expect(lifted.items.loadout.level).toEqual(loadout)
  expect(lifted.audio.level).toEqual(audio)
  // the start reads the same before and after the lift (a terrain page has no spawn height)
  expect(levelStart(lifted, true)).toEqual(levelStart(older, true))
  expect(levelStart(older, true)).toEqual({ spawn: { x: 1, z: 2, yaw: 3 }, loadout, audio })
  // a lifted source, or one with nothing to lift, comes back as it is
  expect(liftLevelStart(lifted)).toBe(lifted)
  const plain = source({ minimap: { outside: 'sea' } })
  expect(liftLevelStart(plain)).toBe(plain)
})

test('OF9b3: a declared world/spawn and declared sections win over the manifest', (): void => {
  const declared: LevelStartSource = { ...source({ spawn: { x: 1, y: 9, z: 2, yaw: 3 }, audio }, SET), audio: parseAudioData({ ...empty, level: { ...audio, score: 'own' } }) }
  const lifted = liftLevelStart(declared)
  expect(lifted.spawn).toEqual(SET)
  expect(lifted.audio.level?.score).toBe('own')
  expect(levelStartRules(declared)).toEqual(['audio.level: the audio lives in audio/audio or the manifest, not both'])
  expect(levelStartRules(lifted)).toEqual([])
  // a structure page keeps the section's height
  expect(levelStart(source(undefined, SET), false).spawn).toEqual(SET)
  expect(levelStart(source(undefined, SET), true).spawn).toEqual({ x: 4, z: -3, yaw: 1 })
})
