import { wave } from './terrain-field.golden-specs.ts'

/* oxlint-disable id-length, import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4f2: interact tables, placements and quest bindings the golden vectors pin. The engine's own
// autoFlag / flagsRaised / flagsRead, readInteractPlacements / bindInteractPlacements, createQuestPlacements and
// compileQuestTable (the oracle, interact-table.golden-gen.mjs) and format's answer the same inputs.
import type {
  InteractTable,
  QuestPlace,
  QuestPlacementPorts,
} from './interact-table.ts'

const at = { poi: 'world', x: 0, z: 0 } as const
export const TABLE: InteractTable = {
  external: ['dead:sailor', 'talked:castaway'],
  rows: [
    {
      kind: 'chest',
      id: 'sea-chest',
      at,
      lock: 'hold',
      contents: [
        { item: 'coin', n: 3 },
        { key: 'cellar', label: 'Cellar key' },
        { flag: 'found:map', label: 'A map' },
      ],
      requires: { all: ['talked:castaway'] },
      sets: ['chest:any'],
    },
    {
      kind: 'key',
      id: 'hold-key',
      at,
      key: 'hold',
      label: 'Hold key',
      showWhen: { any: ['dead:sailor'] },
    },
    {
      kind: 'door',
      id: 'sluice',
      at,
      w: 2,
      h: 3,
      look: 'sluice',
      opensWhen: { all: ['plate:p1'], none: ['lever:jam'] },
      latch: true,
      lock: 'cellar',
    },
    {
      kind: 'lever',
      id: 'jam',
      at,
      label: 'Jam',
      latch: true,
      sets: ['jammed'],
    },
    { kind: 'lever', id: 'loose', at, label: 'Loose' },
    { kind: 'plate', id: 'p1', at, size: 1.5, by: 'barrel' },
    { kind: 'barrel', id: 'b1', at, leash: 12 },
    {
      kind: 'pickup',
      id: 'flint',
      at,
      look: 'flint',
      item: 'flint',
      label: 'Flint',
      sets: ['has:flint'],
      requires: { none: ['jammed'] },
    },
    { kind: 'beacon', id: 'b-lit', at, label: 'Beacon' },
    {
      kind: 'bench',
      id: 'seat',
      at,
      label: 'Sit',
      showWhen: { all: ['lit:b-lit'] },
    },
    {
      kind: 'altar',
      id: 'altar',
      at,
      label: 'Altar',
      fills: ['shard:1', 'shard:2'],
      socketLook: 'token',
    },
  ],
}

export const BINDINGS: readonly (readonly {
  readonly id: string
  readonly act: number
}[])[] = [
  [
    { id: 'flint', act: 1 },
    { id: 'seat', act: 2 },
    { id: 'jam', act: 3 },
  ],
  [{ id: 'loose', act: 1 }],
  [{ id: 'nobody', act: 1 }],
  [{ id: 'sea-chest', act: 1 }],
]

export const PLACEMENTS: readonly unknown[] = [
  TABLE.rows.map((row, i) => ({
    id: row.id,
    kind: row.kind,
    x: i * 2.5,
    y: 1 + i,
    z: -i - 0.5,
    yaw: i * 0.1,
  })),
  TABLE.rows
    .slice(1)
    .map(row => ({ id: row.id, kind: row.kind, x: 0, y: 0, z: 0, yaw: 0 })),
  [{ id: 'a', kind: 'chest', x: Number.NaN, y: 0, z: 0, yaw: 0 }],
  [
    { id: 'a', kind: 'chest', x: 0, y: 0, z: 0, yaw: 0 },
    { id: 'a', kind: 'chest', x: 0, y: 0, z: 0, yaw: 0 },
  ],
  'rows',
]

export const PORTS: QuestPlacementPorts = {
  terrain: (x: number, z: number): number =>
    0.5 * wave(x / 63) + 0.25 * wave(z / 90 + 0.25),
  platforms: [
    (x: number, z: number): number | undefined =>
      Math.abs(x) < 5 && Math.abs(z) < 5 ? 2 : undefined,
  ],
  registry: {
    floorAt: (x: number): number | undefined => (x > 20 ? 1.4 : undefined),
  },
  registryReach: 1.5,
  frames: {
    hut: { x: 10, z: -4, rot: 0.6 },
    wreck: { x: -30, z: 12, rot: -2.1 },
  },
  pois: {
    wreck: {
      anchors: {
        holdDoor: { x: -28, z: 15, yaw: 1.1 },
        deck: { x: -31, z: 10, y: 3.5 },
      },
    },
    hut: null,
  },
}

export const PLACES: readonly QuestPlace[] = [
  { poi: 'world', x: 3, z: 4 },
  { poi: 'world', x: 25, z: 0, dy: 0.3 },
  { poi: 'hut', x: 2, z: 1, yaw: 0.4 },
  { poi: 'hut', x: 2, z: 1, y: 7 },
  { poi: 'wreck', x: 1, z: 1, anchor: 'wreck.holdDoor' },
  { poi: 'wreck', x: 1, z: 1, anchor: 'wreck.deck', dy: 0.5 },
  { poi: 'wreck', x: 1, z: 1, anchor: 'wreck.missing' },
  { poi: 'wreck', x: 1, z: 1, anchor: 'mine' },
  { poi: 'cave', x: 0, z: 0 },
  { poi: 'world', x: Number.POSITIVE_INFINITY, z: 0 },
]

/** An answer, or the refusal's message. */
export function answer(run: () => unknown): unknown {
  try {
    return { ok: run() }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
