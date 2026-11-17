/* oxlint-disable typescript/explicit-function-return-type -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4a: the grid constants the bake and the engine both read are declared once, here. The values are the
// engine's (shared/engine/core/config.ts) at the move; the engine re-exports these from SP5 on.
import { describe, expect, it } from 'vitest'

import {
  CHUNK_HALF,
  CONTENT_CAPS,
  ROAD_LENGTH,
  ROAD_WIDTH,
} from './contentBounds.ts'

describe('grid constants', () => {
  it('match the engine values at the move', () => {
    expect(ROAD_WIDTH).toBe(15)
    expect(ROAD_LENGTH).toBe(60)
    expect(CHUNK_HALF).toBe(250)
    expect(CONTENT_CAPS.l0.size).toBe(62.5)
  })
  it('keep the entry road at least 50 m into the cell', () => {
    expect(ROAD_LENGTH).toBeGreaterThanOrEqual(50)
  })
})
