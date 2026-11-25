// Meta QA 11-25 row 45 (J505): shard-format v0.79.0's npm publish failed on store drift (nalati-grasslands r5 and
// proof-stranger r1, uploads the API's daily prune had not taken yet), not on a shard it could not read. A release
// asks the corpus whether every stored shard still reads; the nightly keeps --strict-store for the store's hygiene.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const workflow = (name: string): string =>
  readFileSync(
    new URL(`../../.github/workflows/${name}`, import.meta.url),
    'utf8',
  )

test('a format release reads every stored shard without blocking on store drift', (): void => {
  const publish = workflow('npm-publish.yml')
  assert.match(
    publish,
    /uses: \.\/\.github\/workflows\/corpus\.yml\n {4}with:\n {6}store: reads\n/u,
  )
})

test('the nightly and a dispatch still block on store drift', (): void => {
  const corpus = workflow('corpus.yml')
  assert.match(
    corpus,
    /store:\n {8}description: [^\n]+\n {8}type: string\n {8}default: strict\n/u,
  )
  assert.match(
    corpus,
    /if \[ "\$STORE" = reads \]; then strict=\(\); else strict=\(--strict-store\); fi/u,
  )
  // The input reaches the shell through env, never inline in the script.
  assert.match(corpus, /STORE: \$\{\{ inputs\.store \}\}\n/u)
})
