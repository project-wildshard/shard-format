import * as v from 'valibot';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const label = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const coord = v.pipe(finite, v.minValue(-250), v.maxValue(250));
const point = v.tuple([coord, coord, coord]);
const positive = v.pipe(finite, v.minValue(0.001), v.maxValue(500));
const duration = v.pipe(finite, v.minValue(0), v.maxValue(60));
const phase = v.strictObject({ at: v.pipe(finite, v.minValue(0.001), v.maxValue(1)), name: label, caption: label, speed: v.pipe(finite, v.minValue(0), v.maxValue(15)), stopDistance: v.pipe(finite, v.minValue(0), v.maxValue(50)), turnRate: v.pipe(finite, v.minValue(0), v.maxValue(30)) });
/**
 * ONE-FORMAT OF34a (J420 (1), Jake 2026-11-18): every boss is three parts. `boss` is the one fight: it `start`s `placed`
 * (its body stands in the world from load, as before), `spawned` (no body until a player enters the arena) or `resident`
 * (its body lives in the world and the fight starts at the first blow, wherever it is), and `capExempt` keeps it out of
 * the cell's fight cap. `boss.arena` is the arena's `bounds`: a `room` resets the fight when every contender has left it,
 * `open` ground when the boss is drawn out past its radius. Tells are any ability's (CC11b), not a boss field. A row
 * without these fields reads as before: placed, capped, no bounds.
 */
const BOSS_STARTS = ['placed', 'spawned', 'resident'] as const;
const ARENA_BOUNDS = ['room', 'open'] as const;
const start = v.exactOptional(v.picklist(BOSS_STARTS, 'Unknown boss start'));
const bounds = v.exactOptional(v.picklist(ARENA_BOUNDS, 'Unknown arena bounds'));
const arena = v.strictObject({ at: point, radius: positive, bounds });
const capExempt = v.exactOptional(v.literal(true));
/** Only a boss starts, and only a boss skips the fight cap. */
function bossOnly(row: Readonly<{ kind: 'elite' | 'boss'; start?: (typeof BOSS_STARTS)[number]; capExempt?: true }>): boolean {
  return row.kind === 'boss' || (row.start === undefined && row.capExempt === undefined);
}
const encounter = v.pipe(v.strictObject({ id, entity: id, kind: v.picklist(['elite', 'boss']), panel: v.nullable(id), name: label, title: label, retry: label,
  start, capExempt, arena, intro: duration, introShort: duration,
  respawn: v.strictObject({ at: point, yaw: finite }), phases: v.pipe(v.array(phase), v.minLength(1), v.maxLength(16)) }),
v.check((e) => e.phases[0]?.at === 1 && e.phases.every((p, i) => i === 0 || p.at < (e.phases[i - 1]?.at ?? 0)), 'descending phase thresholds starting at 1'),
v.check<ShardEncounters[number], string>(bossOnly, 'Only a boss has a start or capExempt'));
/** Elite/boss phase tables with checkpoints/retry, neutral steering data and declared panel references. */
export const EncountersSchema: v.GenericSchema<ShardEncountersInput, ShardEncounters> = v.pipe(v.array(encounter), v.maxLength(64), v.check((rows) => new Set(rows.map((e) => e.id)).size === rows.length && new Set(rows.map((e) => e.entity)).size === rows.length, 'unique encounter ids and actors'));
/** Validated data-only encounter tables. */

/** Full-loader references: declared actor spawn and the existing SF7f boss panel (if any). */
export function encounterRules(rows: ShardEncounters, entities: readonly string[], panels: readonly { id: string; encounter: string }[]): string[] {
  const errors: string[] = [];
  for (const row of rows) {
    if (!entities.includes(row.entity)) errors.push('declared encounter actor');
    if (row.panel !== null && !panels.some((p) => p.id === row.panel && p.encounter === row.id)) errors.push('declared matching boss panel');
  }
  return [...new Set(errors)];
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type ShardEncountersInput = ShardEncounters;
export type ShardEncounters = ({
    id: string;
    entity: string;
    kind: 'elite' | 'boss';
    panel: (string) | null;
    name: string;
    title: string;
    retry: string;
    start?: (typeof BOSS_STARTS)[number];
    capExempt?: true;
    arena: {
        at: [
            number,
            number,
            number
        ];
        radius: number;
        bounds?: (typeof ARENA_BOUNDS)[number];
    };
    intro: number;
    introShort: number;
    respawn: {
        at: [
            number,
            number,
            number
        ];
        yaw: number;
    };
    phases: ({
        at: number;
        name: string;
        caption: string;
        speed: number;
        stopDistance: number;
        turnRate: number;
    })[];
})[];
