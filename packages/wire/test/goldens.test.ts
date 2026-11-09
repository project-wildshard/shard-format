import assert from 'node:assert/strict'
import { test } from 'node:test'

import { reencodeGolden } from '../cli/golden-codec.ts'
import GOLDENS from '../fixtures/v0.json' with { type: 'json' }

for (const fixture of GOLDENS.fixtures) {
  test(`engine cfd6681 golden ${fixture.name} re-encodes identical bytes`, (): void => {
    const decoded = reencodeGolden(
      fixture.stream,
      Buffer.from(fixture.hex, 'hex'),
    )
    assert.ok(decoded !== undefined)
    assert.equal(Buffer.from(decoded).toString('hex'), fixture.hex)
  })
}
for (const fixture of GOLDENS.malformed) {
  test(`engine cfd6681 refuses ${fixture.name}`, (): void => {
    assert.equal(
      reencodeGolden(fixture.stream, Buffer.from(fixture.hex, 'hex')),
      undefined,
    )
  })
}
