import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isIssueCode,
  issueCodeRows,
  issueCodeOf,
  tagIssue,
} from '../format/issue-codes.ts'
import {
  CODES_PATH,
  FAMILIES,
  readCodes,
  renderCodes,
} from './validation-codes.ts'

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

describe('docs/VALIDATION-CODES.md', (): void => {
  it('matches the code: run `node src/tools/validation-codes.ts write`', async (): Promise<void> => {
    assert.equal(await readCodes(), renderCodes(), `${CODES_PATH} is stale`)
  })

  it('lists every code once, kebab-case, in a family the page has', (): void => {
    const families = new Set(
      FAMILIES.map(([family]: readonly [string, string]): string => family),
    )
    for (const { code, family, meaning } of issueCodeRows()) {
      assert.match(code, KEBAB)
      assert.ok(families.has(family), `${code} has no family table`)
      assert.ok(meaning.length > 0, `${code} has no meaning`)
      assert.equal(
        renderCodes().split(`| \`${code}\` |`).length,
        2,
        `${code} is not listed once`,
      )
    }
  })
})

describe('issue code helpers', (): void => {
  it('tags an untagged or host-coded error and keeps a nearer tag', (): void => {
    const plain = new Error('x')
    const host = Object.assign(new Error('y'), { code: 'ENOENT' })
    const near = Object.assign(new Error('z'), { code: 'file-mismatch' })
    tagIssue(plain, 'unlisted-file')
    tagIssue(host, 'unlisted-file')
    tagIssue(near, 'unlisted-file')
    assert.equal(issueCodeOf(plain), 'unlisted-file')
    assert.equal(plain.message, 'x')
    assert.equal(issueCodeOf(host), 'unlisted-file')
    assert.equal(issueCodeOf(near), 'file-mismatch')
  })

  it('shadows a read-only code getter and leaves a frozen error as it is', (): void => {
    const aborted = new DOMException('aborted', 'AbortError')
    const frozen = Object.freeze(new Error('kept'))
    assert.equal(tagIssue(aborted, 'archive-invalid'), aborted)
    assert.equal(issueCodeOf(aborted), 'archive-invalid')
    assert.equal(aborted.message, 'aborted')
    assert.equal(tagIssue(frozen, 'archive-invalid'), frozen)
    assert.equal(issueCodeOf(frozen), undefined)
  })

  it("knows only the table's codes", (): void => {
    assert.equal(isIssueCode('perf-script-cpu'), true)
    assert.equal(isIssueCode('toString'), false)
  })
})
