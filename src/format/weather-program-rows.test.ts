import { expect, test } from 'vitest'

import { parseRows } from './rows.ts'

// ONE-FORMAT OF23e3: a `world/weather` row names a weather program instead of a plain chain, so a shard whose weather is
// a program (Pine's) switches the weather primitive on with a row and drops its native `weather.program` host.
const empty = {
  strikes: [],
  days: [],
  species: [],
  looks: [],
  compendiums: [],
  loot: [],
}
const calm = { overcast: 0, rain: 0, wet: 0, wind: 0.1, fog: 0 }
const chain = {
  id: 'fixture.chain',
  initial: calm,
  soak: 0.1,
  dry: 0.1,
  modes: [],
  states: [{ id: 'clear', next: 'clear', length: [2, 2], numbers: calm }],
}

test('OF23e3: a weather row may name its program beside a plain chain', () => {
  const rows = parseRows({
    ...empty,
    weather: [chain, { id: 'fixture.air', program: 'world/weather.json' }],
  })
  expect(rows.weather[1]).toEqual({
    id: 'fixture.air',
    program: 'world/weather.json',
  })
})

test('OF23e3: a program row carries nothing else, and names a file', () => {
  expect(() =>
    parseRows({
      ...empty,
      weather: [{ id: 'fixture.air', program: 'world/weather.json', soak: 0.1 }],
    }),
  ).toThrow()
  expect(() =>
    parseRows({ ...empty, weather: [{ id: 'fixture.air', program: '' }] }),
  ).toThrow()
})

test('OF23e3: program and chain rows still share unique ids', () => {
  expect(() =>
    parseRows({
      ...empty,
      weather: [chain, { id: 'fixture.chain', program: 'world/weather.json' }],
    }),
  ).toThrow()
})
