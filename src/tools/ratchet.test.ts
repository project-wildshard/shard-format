import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { baselineText, compareBaseline, countLint } from './ratchet.ts'

const OXLINT_JSON = {
  diagnostics: [
    { filename: 'src/format/b.ts', code: 'eslint(curly)' },
    { filename: 'src/format/a.ts', code: 'eslint(curly)' },
    { filename: 'src/format/a.ts', code: 'eslint(curly)' },
    { filename: 'src/format/a.ts' },
  ],
}

describe('counting oxlint output', (): void => {
  it('counts diagnostics by file and rule', (): void => {
    assert.deepEqual(countLint(OXLINT_JSON), {
      'src/format/a.ts': {
        'eslint(curly)': 2,
        'unused-disable-directive': 1,
      },
      'src/format/b.ts': { 'eslint(curly)': 1 },
    })
  })

  it('passes when nothing moved', (): void => {
    const state = { lint: countLint(OXLINT_JSON), unformatted: ['x.ts'] }

    assert.deepEqual(compareBaseline(state, state), { rises: [], drops: [] })
  })
})

describe('a rise', (): void => {
  it('fails a higher count, a new rule, a new file and new unformatted code', (): void => {
    const baseline = {
      lint: { 'a.ts': { 'eslint(curly)': 1 } },
      unformatted: [],
    }
    const current = {
      lint: {
        'a.ts': { 'eslint(curly)': 2, 'eslint(no-var)': 1 },
        'new.ts': { 'eslint(curly)': 1 },
      },
      unformatted: ['a.ts'],
    }

    assert.deepEqual(compareBaseline(baseline, current).rises, [
      'a.ts: eslint(curly) 1 -> 2',
      'a.ts: eslint(no-var) 0 -> 1',
      'new.ts: eslint(curly) 0 -> 1',
      'a.ts: newly unformatted',
    ])
  })
})

describe('a drop', (): void => {
  it('is reported apart from rises, so the baseline can only shrink', (): void => {
    const baseline = {
      lint: {
        'a.ts': { 'eslint(curly)': 3 },
        'gone.ts': { 'eslint(curly)': 1 },
      },
      unformatted: ['a.ts'],
    }
    const current = {
      lint: { 'a.ts': { 'eslint(curly)': 1 } },
      unformatted: [],
    }

    assert.deepEqual(compareBaseline(baseline, current), {
      rises: [],
      drops: [
        'a.ts: eslint(curly) 3 -> 1',
        'gone.ts: eslint(curly) 1 -> 0',
        'a.ts: now formatted',
      ],
    })
  })
})

describe('the baseline file', (): void => {
  it('is written in a stable order', (): void => {
    const text = baselineText({
      lint: {
        'b.ts': { 'eslint(no-var)': 1, 'eslint(curly)': 1 },
        'a.ts': { 'eslint(curly)': 1 },
      },
      unformatted: ['b.ts', 'a.ts'],
    })

    assert.ok(text.indexOf('"a.ts"') < text.indexOf('"b.ts"'))
    assert.ok(text.indexOf('curly') < text.indexOf('no-var'))
    assert.ok(text.endsWith(']\n}\n'))
  })
})
