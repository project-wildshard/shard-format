import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { EncountersSchema, encounterRules } from './encounters.ts'

// ONE-FORMAT CC59: an encounter phase lists the spawn rows that join the fight when it reaches that phase.
const phase = {
  at: 0.5,
  name: 'two',
  caption: 'Two',
  speed: 3,
  stopDistance: 2,
  turnRate: 4,
  adds: ['imp:1', 'imp:2', 'imp:3'],
}
const warden = {
  id: 'warden',
  entity: 'warden:1',
  kind: 'boss',
  // oxlint-disable-next-line unicorn/no-null -- an encounter row's panel is JSON null when it has none
  panel: null,
  name: 'Warden',
  title: 'The Warden',
  retry: 'Try again',
  arena: { at: [0, 0, 0], radius: 20 },
  intro: 1,
  introShort: 0.5,
  respawn: { at: [0, 0, 25], yaw: 0 },
  phases: [
    {
      at: 1,
      name: 'one',
      caption: 'One',
      speed: 3,
      stopDistance: 2,
      turnRate: 4,
    },
    phase,
  ],
}

function rules(adds: readonly string[]): string[] {
  const parsed = safeParse(EncountersSchema, [
    { ...warden, phases: [warden.phases[0], { ...phase, adds }] },
  ])
  if (!parsed.success) {
    return ['schema']
  }
  return encounterRules(
    parsed.output,
    ['warden:1', 'imp:1', 'imp:2', 'imp:3'],
    [],
  )
}

test('a phase lists the declared spawns that join it', (): void => {
  expect(rules(['imp:1', 'imp:2', 'imp:3'])).toEqual([])
  expect(rules(['imp:9'])).toEqual(['phase adds name other declared spawns'])
  expect(rules(['warden:1'])).toEqual(['phase adds name other declared spawns'])
  expect(rules([])).toEqual(['schema'])
})
