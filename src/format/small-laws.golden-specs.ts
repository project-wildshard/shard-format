/* oxlint-disable id-length, import/group-exports, no-magic-numbers -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4f1: inputs the golden vectors pin for the headless section list, the road light and the mover rest pose.
// The engine's own functions and constants (the oracle, small-laws.golden-gen.mjs) and format's answer the same inputs.

/** A product's sections, as `[name, value]` pairs; values the format parser refuses become refusals. */
export const SECTION_INPUTS: readonly (readonly (readonly [
  string,
  unknown,
])[])[] = [
  [],
  [
    ['world/targets', { spots: [], targets: [] }],
    ['not/a-section', 1],
  ],
  [['sim/bodies', 'nope']],
]

export const MOVER_CASES: readonly {
  readonly reads: readonly string[]
  readonly pose: {
    readonly position: {
      readonly x: number
      readonly y: number
      readonly z: number
    }
    readonly euler: {
      readonly x: number
      readonly y: number
      readonly z: number
    }
    readonly enabled: boolean
  }
  readonly fields: Readonly<Record<number, number>>
}[] = [
  {
    reads: [
      'enabled',
      'position.x',
      'position.y',
      'position.z',
      'euler.x',
      'euler.y',
      'euler.z',
    ],
    pose: {
      position: { x: 1.5, y: -2, z: 3.25 },
      euler: { x: 0.1, y: -0.2, z: 0.3 },
      enabled: true,
    },
    fields: {},
  },
  {
    reads: ['field.1', 'field.6', 'enabled'],
    pose: {
      position: { x: 0, y: 0, z: 0 },
      euler: { x: 0, y: 0, z: 0 },
      enabled: false,
    },
    fields: { 1: 0.5, 6: -7 },
  },
  {
    reads: ['field.2'],
    pose: {
      position: { x: 0, y: 0, z: 0 },
      euler: { x: 0, y: 0, z: 0 },
      enabled: true,
    },
    fields: { 1: 1 },
  },
  {
    reads: ['field.7'],
    pose: {
      position: { x: 0, y: 0, z: 0 },
      euler: { x: 0, y: 0, z: 0 },
      enabled: true,
    },
    fields: { 7: 1 },
  },
  {
    reads: ['position.w'],
    pose: {
      position: { x: 0, y: 0, z: 0 },
      euler: { x: 0, y: 0, z: 0 },
      enabled: true,
    },
    fields: {},
  },
]

/** An answer, or the refusal's message. */
export function answer(run: () => unknown): unknown {
  try {
    const value = run()
    return { ok: value instanceof Map ? [...value.entries()] : value }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
