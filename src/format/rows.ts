import { StrikeDebrisSchema, strikeDebrisCatalogueRules } from './strike-debris.ts';
import type { StrikeDebrisPolicy } from './strike-debris.ts';
import type { HarvestDrop } from './harvest-rows.ts';
import { HarvestDropsSchema, harvestSpeciesRules } from './harvest-rows.ts';
import { LootEconomySchema, BarterEconomySchema, lootEconomyRules } from './lootEconomy.ts';
import * as v from 'valibot';
import { isJsonData } from './json.ts';
import { sketchReference } from './sketch.ts';
import { JournalRowSchema, journalRowRules } from './compendiumRows.ts';
import { CreatureMountSchema, creatureMountRules, CreatureTypeSchema, CreatureBodySchema, CreatureTemperamentSchema, CreatureSensesSchema, CreatureAbilitySchema, CreaturePresentationSchema } from './creature-layers.ts';
import type { CreatureAbilityInput, CreatureLayers } from './creature-layers.ts';
import { creatureSizeRules } from './creature-sizes.ts';
import { SKIN_CLIPS_RECIPE, SkinClipMapSchema } from './skins.ts';
import type { SkinClipMap } from './skins.ts';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0.000001), v.maxValue(10000000));
const nonnegative = v.pipe(finite, v.minValue(0), v.maxValue(10000000));
const unit = v.pipe(finite, v.minValue(0), v.maxValue(1));
const dimension = v.pipe(positive, v.maxValue(20));
const duration = v.pipe(positive, v.maxValue(86400));
const ordered = v.pipe(v.tuple([positive, positive]), v.check(([a, b]) => a <= b, 'ordered range'));
const shape = v.variant('kind', [
  v.strictObject({ kind: v.literal('point'), radius: dimension }), v.strictObject({ kind: v.literal('sphere'), radius: dimension }),
  v.strictObject({ kind: v.literal('lane'), length: dimension, width: dimension }),
  v.strictObject({ kind: v.literal('arc'), radius: dimension, halfAngle: v.pipe(positive, v.maxValue(Math.PI)) }),
  v.strictObject({ kind: v.literal('wedge'), length: dimension, halfAngle: v.pipe(positive, v.maxValue(Math.PI)) }),
  v.pipe(v.strictObject({ kind: v.literal('ring'), inner: nonnegative, outer: dimension }), v.check((r) => r.inner <= r.outer, 'ordered ring')),
]);
const strike: v.StrictObjectSchema<{ readonly debris: v.ExactOptionalSchema<v.GenericSchema<StrikeDebrisPolicy>, undefined>; readonly id: v.GenericSchema<StrikeRowsInput['id'], StrikeRows['id']>; readonly shape: v.GenericSchema<StrikeRowsInput['shape'], StrikeRows['shape']>; readonly windup: v.GenericSchema<StrikeRowsInput['windup'], StrikeRows['windup']>; readonly active: v.GenericSchema<StrikeRowsInput['active'], StrikeRows['active']>; readonly recover: v.GenericSchema<StrikeRowsInput['recover'], StrikeRows['recover']>; readonly cooldown: v.GenericSchema<StrikeRowsInput['cooldown'], StrikeRows['cooldown']>; readonly range: v.GenericSchema<StrikeRowsInput['range'], StrikeRows['range']>; readonly damage: v.GenericSchema<StrikeRowsInput['damage'], StrikeRows['damage']>; readonly tags: v.SchemaWithPipe<readonly [v.ArraySchema<v.GenericSchema<`${string}.${string}`>, undefined>, v.MaxLengthAction<StrikeRows['tags'], 32, undefined>]>; readonly weight: v.GenericSchema<StrikeRowsInput['weight'], StrikeRows['weight']>; readonly speed: v.GenericSchema<StrikeRowsInput['speed'], StrikeRows['speed']>; }, undefined> = v.strictObject({ debris: v.exactOptional(StrikeDebrisSchema), id, shape, windup: nonnegative, active: nonnegative, recover: nonnegative, cooldown: nonnegative, range: dimension, damage: nonnegative,
  tags: v.pipe(v.array(v.custom<`${string}.${string}`>((value) => typeof value === 'string' && value.length <= 128 && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value))), v.maxLength(32)), weight: nonnegative, speed: v.pipe(nonnegative, v.maxValue(15)) });
const numbers = v.strictObject({ overcast: unit, rain: unit, wet: unit, wind: unit, fog: unit });
const weather = v.strictObject({ id, states: v.pipe(v.array(v.strictObject({ id, next: id, length: ordered, numbers })), v.minLength(1), v.maxLength(64)), initial: numbers, soak: unit, dry: unit,
  modes: v.pipe(v.array(v.strictObject({ id, hold: v.nullable(id), at: unit, dry: v.boolean() })), v.maxLength(64)) });
const hour = v.pipe(finite, v.minValue(0), v.maxValue(24));
const day = v.strictObject({ id, units: v.literal('hour'), start: hour,
  schedule: v.pipe(v.array(v.strictObject({ phase: v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), from: hour, to: hour, minutes: duration })), v.minLength(1), v.maxLength(64)),
  sun: v.strictObject({ maxElevation: v.pipe(finite, v.minValue(0), v.maxValue(90)), azimuthOffset: v.pipe(finite, v.minValue(-180), v.maxValue(180)) }),
  fixed: v.strictObject({ midday: hour, golden: hour, sunset: hour, night: hour }), presets: v.strictObject({ dawn: hour, noon: hour, dusk: hour, night: hour }) });
const mods = v.strictObject({ speed: positive, chargeDist: positive, damageTaken: positive, chargeDamage: nonnegative, relentless: v.boolean() });
const dims = v.strictObject({ bodyY: dimension, bodyHalfLen: dimension, bodyRadius: dimension, headRadius: dimension, legLen: dimension,
  feet: v.pipe(v.array(v.tuple([finite, finite])), v.maxLength(16)), halfWidth: dimension });
const variant = v.strictObject({ id, label: text, rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']), weight: nonnegative, scale: ordered, hp: positive, mods });
const flight = v.strictObject({ altitude: v.pipe(finite, v.minValue(-250), v.maxValue(250)),
  above: v.exactOptional(v.picklist(['ground', 'world'])), climbRate: v.pipe(positive, v.maxValue(30)), diveRate: v.pipe(positive, v.maxValue(30)),
  lockRange: v.exactOptional(v.pipe(positive, v.maxValue(600))), bank: v.exactOptional(v.pipe(finite, v.check(n => n > 0 && n < Math.PI / 2, 'flight bank between 0 and pi/2'))) });
const MAX_ABILITIES = 32;
const abilities = v.pipe(v.array(CreatureAbilitySchema), v.maxLength(MAX_ABILITIES));
const species = v.strictObject({ id, kind: id, label: text, capExempt: v.exactOptional(v.boolean()), harvest: v.exactOptional(HarvestDropsSchema), aggressive: v.boolean(), lockable: v.boolean(), dims, flight: v.exactOptional(flight),
  variants: v.pipe(v.array(variant), v.minLength(1), v.maxLength(64)),
  type: v.exactOptional(CreatureTypeSchema), body: v.exactOptional(CreatureBodySchema),
  temperament: v.exactOptional(CreatureTemperamentSchema), senses: v.exactOptional(CreatureSensesSchema),
  abilities: v.exactOptional(abilities), presentation: v.exactOptional(CreaturePresentationSchema), mount: v.exactOptional(CreatureMountSchema) });
const parameter = v.union([finite, v.boolean(), text, v.pipe(v.array(finite), v.maxLength(16))]);
const animationParameters = v.record(id, parameter);
const lookAnimation = v.strictObject({
  recipe: id, parameters: animationParameters, clipMap: v.exactOptional(SkinClipMapSchema),
});
const look = v.strictObject({ id, species: id, recipe: id, material: v.optional(v.nullable(id), null), parameters: v.record(id, parameter),
  animation: lookAnimation });
const basicCompendium = v.strictObject({ id, className: id, title: text, tabs: v.pipe(v.array(v.strictObject({ id, label: text })), v.maxLength(16)), stamp: text,
  stats: v.pipe(v.array(v.strictObject({ label: text, value: text })), v.maxLength(8)),
  entries: v.pipe(v.array(v.strictObject({ id, kind: v.literal('species'), tab: id, name: text, notes: text, sketch: v.pipe(text, v.check(sketchReference, 'bounded inert SVG data or admitted sketch hash')), species: id })), v.maxLength(256)) });
const loot = v.union([
  v.strictObject({ id, gear: v.literal('purse.coins'), finds: v.null(), marks: v.null(), charted: v.boolean(), chime: id, economy: v.exactOptional(LootEconomySchema) }),
  v.strictObject({ id, economy: BarterEconomySchema }),
]);
const raw: v.StrictObjectSchema<{ readonly strikes: v.SchemaWithPipe<readonly [v.ArraySchema<typeof strike, undefined>, v.MaxLengthAction<ShardRows['strikes'], 256, undefined>]>; readonly weather: v.GenericSchema<ShardRowsInput['weather'], ShardRows['weather']>; readonly days: v.GenericSchema<ShardRowsInput['days'], ShardRows['days']>; readonly species: v.GenericSchema<ShardRowsInput['species'], ShardRows['species']>; readonly looks: v.GenericSchema<ShardRowsInput['looks'], ShardRows['looks']>; readonly compendiums: v.GenericSchema<ShardRowsInput['compendiums'], ShardRows['compendiums']>; readonly loot: v.GenericSchema<ShardRowsInput['loot'], ShardRows['loot']>; }, undefined> = v.strictObject({ strikes: v.pipe(v.array(strike), v.maxLength(256)), weather: v.pipe(v.array(weather), v.maxLength(16)), days: v.pipe(v.array(day), v.maxLength(16)),
  species: v.pipe(v.array(species), v.maxLength(256)), looks: v.pipe(v.array(look), v.maxLength(256)), compendiums: v.pipe(v.array(v.union([basicCompendium, JournalRowSchema])), v.maxLength(16)), loot: v.pipe(v.array(loot), v.maxLength(16)) });
/** Pure author rows: numeric weights, state output tables, clocks and registered view/presentation recipes. */

/** Reference, uniqueness and complete clock/weather transition rules for data rows. */
function rowRules(rows: ShardRows): string[] {
  const errors: string[] = harvestSpeciesRules(rows.species);
  for (const list of Object.values(rows)) if (new Set(list.map((r) => r.id)).size !== list.length) errors.push('unique row ids');
  for (const row of rows.loot) if (row.economy !== undefined && !('kind' in row.economy)) errors.push(...lootEconomyRules(row.economy));
  for (const w of rows.weather) {
    const states = new Set(w.states.map((s) => s.id));
    if (states.size !== w.states.length || w.states.some((s) => !states.has(s.next)) || w.modes.some((m) => m.hold !== null && !states.has(m.hold)) || new Set(w.modes.map((m) => m.id)).size !== w.modes.length) errors.push('weather states and transitions');
  }
  for (const d of rows.days) if (d.schedule[0]?.from !== 0 || d.schedule.at(-1)?.to !== 24 || d.schedule.some((s, i) => s.from >= s.to || (i > 0 && d.schedule[i - 1]?.to !== s.from))) errors.push('complete ordered day schedule');
  const speciesIds = new Set(rows.species.map((s) => s.id));
  errors.push(...strikeDebrisCatalogueRules(rows), ...creatureSizeRules(rows.species), ...creatureMountRules(rows.species));
  for (const s of rows.species) if (new Set(s.variants.map((r) => r.id)).size !== s.variants.length || s.variants.some((r) => r.scale[1] > 10)) errors.push('species variants');
  const strikeIds = new Set<string>();
  for (const strikeRow of rows.strikes) { strikeIds.add(strikeRow.id); }
  const lookIds = new Set<string>();
  for (const lookRow of rows.looks) {
    lookIds.add(lookRow.id);
    if (lookRow.animation.clipMap !== undefined && lookRow.animation.recipe !== SKIN_CLIPS_RECIPE) {
      errors.push('Clip maps require platform.clips');
    }
  }
  for (const speciesRow of rows.species) {
    for (const ability of speciesRow.abilities ?? []) {
      if (!strikeIds.has(ability.use)) { errors.push(`Unknown creature ability: ${ability.use}`); }
    }
    if (speciesRow.body !== undefined && !lookIds.has(speciesRow.body.look)) { errors.push(`Unknown creature look: ${speciesRow.body.look}`); }
  }
  for (const l of rows.looks) if (!speciesIds.has(l.species)) errors.push('look species');
  for (const c of rows.compendiums) {
    if ('kind' in c) { errors.push(...journalRowRules(c)); continue; }
    const tabs = new Set(c.tabs.map((t) => t.id));
    if (tabs.size !== c.tabs.length || new Set(c.entries.map((e) => e.id)).size !== c.entries.length || c.entries.some((e) => !tabs.has(e.tab) || !speciesIds.has(e.species))) errors.push('compendium references');
  }
  return errors;
}
function rowMessage(issue: Readonly<{ input: unknown }>): string {
  const data = v.parse(raw, issue.input);
  const reasons = rowRules(data);
  return `row reference rules: ${reasons.join('; ')}`;
}
/** The independent JSON check runs before strict row schemas; functions/accessors/cycles never become data. */
const RowsSchema: v.SchemaWithPipe<readonly [v.UnknownSchema, v.CheckAction<unknown, 'JSON-only rows'>, typeof raw, v.CheckAction<ShardRows, typeof rowMessage>]> = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only rows'), raw, v.check((rows) => rowRules(rows).length === 0, rowMessage));
/** Validate rows at the author boundary, before JSON serialization can erase closures. */
function parseRows(input: unknown): ShardRows { return v.parse(RowsSchema, input); }

/** Admitted author data independent of validator implementation metadata. */
type StrikeRowsInput = StrikeRows;
interface StrikeRows { debris?: StrikeDebrisPolicy; id: string; shape: ({ kind: 'point'; radius: number; }) | ({ kind: 'sphere'; radius: number; }) | ({ kind: 'lane'; length: number; width: number; }) | ({ kind: 'arc'; radius: number; halfAngle: number; }) | ({ kind: 'wedge'; length: number; halfAngle: number; }) | ({ kind: 'ring'; inner: number; outer: number; }); windup: number; active: number; recover: number; cooldown: number; range: number; damage: number; tags: (`${string}.${string}`)[]; weight: number; speed: number; }
interface ShardRowsInput { strikes: (StrikeRowsInput)[]; weather: ({ id: string; states: ({ id: string; next: string; length: [number, number]; numbers: { overcast: number; rain: number; wet: number; wind: number; fog: number; }; })[]; initial: { overcast: number; rain: number; wet: number; wind: number; fog: number; }; soak: number; dry: number; modes: ({ id: string; hold: (string) | null; at: number; dry: boolean; })[]; })[]; days: ({ id: string; units: 'hour'; start: number; schedule: ({ phase: 'dawn' | 'day' | 'golden' | 'dusk' | 'night'; from: number; to: number; minutes: number; })[]; sun: { maxElevation: number; azimuthOffset: number; }; fixed: { midday: number; golden: number; sunset: number; night: number; }; presets: { dawn: number; noon: number; dusk: number; night: number; }; })[]; species: SpeciesRowInput[]; looks: ({ id: string; species: string; recipe: string; material?: (string) | null | undefined; parameters: Record<string, (number) | (boolean) | (string) | ((number)[])>; animation: { recipe: string; parameters: Record<string, (number) | (boolean) | (string) | ((number)[])>; clipMap?: SkinClipMap<string>; }; })[]; compendiums: (({ id: string; className: string; title: string; tabs: ({ id: string; label: string; })[]; stamp: string; stats: ({ label: string; value: string; })[]; entries: ({ id: string; kind: 'species'; tab: string; name: string; notes: string; sketch: string; species: string; })[]; }) | (v.InferInput<typeof JournalRowSchema>))[]; loot: (({ id: string; gear: 'purse.coins'; finds: null; marks: null; charted: boolean; chime: string; economy?: v.InferInput<typeof LootEconomySchema>; }) | ({ id: string; economy: v.InferInput<typeof BarterEconomySchema>; }))[]; }
// oxlint-disable-next-line typescript/consistent-type-definitions -- Object.values needs the original implicit dictionary contract for row validation.
type ShardRows = { strikes: (StrikeRows)[]; weather: ({ id: string; states: ({ id: string; next: string; length: [number, number]; numbers: { overcast: number; rain: number; wet: number; wind: number; fog: number; }; })[]; initial: { overcast: number; rain: number; wet: number; wind: number; fog: number; }; soak: number; dry: number; modes: ({ id: string; hold: (string) | null; at: number; dry: boolean; })[]; })[]; days: ({ id: string; units: 'hour'; start: number; schedule: ({ phase: 'dawn' | 'day' | 'golden' | 'dusk' | 'night'; from: number; to: number; minutes: number; })[]; sun: { maxElevation: number; azimuthOffset: number; }; fixed: { midday: number; golden: number; sunset: number; night: number; }; presets: { dawn: number; noon: number; dusk: number; night: number; }; })[]; species: SpeciesRow[]; looks: ({ id: string; species: string; recipe: string; material: (string) | null; parameters: Record<string, (number) | (boolean) | (string) | ((number)[])>; animation: { recipe: string; parameters: Record<string, (number) | (boolean) | (string) | ((number)[])>; clipMap?: SkinClipMap; }; })[]; compendiums: (({ id: string; className: string; title: string; tabs: ({ id: string; label: string; })[]; stamp: string; stats: ({ label: string; value: string; })[]; entries: ({ id: string; kind: 'species'; tab: string; name: string; notes: string; sketch: string; species: string; })[]; }) | (v.InferOutput<typeof JournalRowSchema>))[]; loot: (({ id: string; gear: 'purse.coins'; finds: null; marks: null; charted: boolean; chime: string; economy?: v.InferOutput<typeof LootEconomySchema>; }) | ({ id: string; economy: v.InferOutput<typeof BarterEconomySchema>; }))[]; };

type SpeciesRowInput = Omit<SpeciesRow, "abilities"> & { abilities?: CreatureAbilityInput[] };

/** A species keeps its old fields, with optional explicit creature layers. */
interface SpeciesRow extends CreatureLayers { capExempt?: boolean; harvest?: HarvestDrop[]; id: string; kind: string; label: string; aggressive: boolean; lockable: boolean; dims: { bodyY: number; bodyHalfLen: number; bodyRadius: number; headRadius: number; legLen: number; feet: ([number, number])[]; halfWidth: number; }; flight?: { altitude: number; above?: 'ground' | 'world'; climbRate: number; diveRate: number; lockRange?: number; bank?: number; }; variants: ({ id: string; label: string; rarity: 'common' | 'uncommon' | 'rare' | 'legendary'; weight: number; scale: [number, number]; hp: number; mods: { speed: number; chargeDist: number; damageTaken: number; chargeDamage: number; relentless: boolean; }; })[]; }

export { rowRules, RowsSchema, parseRows };
export type { StrikeRowsInput, StrikeRows, ShardRowsInput, ShardRows, SpeciesRow };
