import { CatalogueIconSchema } from './items.ts';
import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const names = v.pipe(v.array(id), v.maxLength(128));
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const worldAt = v.strictObject({ poi: v.literal('world'), x: finite, z: finite, y: v.exactOptional(finite) });
const marker = v.strictObject({ id, label: text, short: v.exactOptional(v.pipe(text, v.maxLength(18))), at: worldAt, hideWhen: v.exactOptional(condition) });
const markers = v.pipe(v.array(marker), v.maxLength(32));
const done = v.pipe(condition, v.check((c) => [...(c.all ?? []), ...(c.any ?? []), ...(c.none ?? [])].length > 0, 'nonempty done condition'));
/** Meta MOSSGATE-ZONE MZ31 (QA 11-19 row 35, "nothing happens"): where a quest beat lands, and how. The engine flares the
 *  spot in `colour`, spreads its light over the ground for `radius` metres, pops a small reward there and sounds one of its own
 *  synth voices (`InteractSfx`, no recorded audio). */
const SPREAD_MIN = 1;
const SPREAD_MAX = 40;
const colour = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/u));
const spread = v.pipe(finite, v.minValue(SPREAD_MIN), v.maxValue(SPREAD_MAX));
const voice = v.picklist(['chime', 'glyph', 'ignite', 'chest', 'lever', 'plate', 'door', 'grate']);
const landing = { at: v.omit(worldAt, ['poi']), colour: v.exactOptional(colour), radius: v.exactOptional(spread), sound: v.exactOptional(voice) };
/** A step's landing: shown where the step was done, the moment its `done` first holds. */
const feedback = v.strictObject(landing);
/** A quest's payoff: a bigger landing as it completes, the score's reward take (`music`, default `dawn`), then the next goal
 *  (`next`) on the tracker. The world change is `onComplete.scene`, the shard's own declared scene hook. */
const music = v.picklist(['dawn', 'none']);
const payoff = v.strictObject({ ...landing, music: v.exactOptional(music), next: v.exactOptional(text) });
const optionalPayoff = v.exactOptional(payoff);
/** MZ31: a quest beat's landing (a step's `feedback`, the base of a quest's `onComplete.payoff`). */
interface QuestFeedbackRows { at: Record<'x' | 'z', number> & Partial<Record<'y', number>>; colour?: string; radius?: number; sound?: 'chime' | 'glyph' | 'ignite' | 'chest' | 'lever' | 'plate' | 'door' | 'grate' }
/** MZ31: a quest's payoff as it completes. */
interface QuestPayoffRows extends QuestFeedbackRows { music?: 'dawn' | 'none'; next?: string }
const step = v.strictObject({ id, objective: text, chip: v.exactOptional(v.pipe(text, v.maxLength(18))), hint: v.exactOptional(text), done, count: v.exactOptional(names), markers: v.exactOptional(markers), feedback: v.exactOptional(feedback) });
const quest = v.strictObject({ id, title: text, track: v.exactOptional(v.boolean()), completeFlag: id, startWhen: v.exactOptional(condition), intro: v.exactOptional(v.strictObject({ objective: text, chip: v.exactOptional(v.pipe(text, v.maxLength(18))), hint: v.exactOptional(text), markers: v.exactOptional(markers) })), steps: v.pipe(v.array(step), v.minLength(1), v.maxLength(64)), onComplete: v.exactOptional(v.strictObject({ fact: v.exactOptional(id), scene: v.exactOptional(id), coins: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100))), payoff: optionalPayoff })) });
/** Complete presentation chapter after its native completion owner is omitted. */
export const QuestPresentationChapterSchema:v.GenericSchema<Omit<QuestDataInput['quests'][number],'onComplete'>,Omit<QuestData['quests'][number],'onComplete'>>=v.omit(quest,['onComplete']);
const trigger = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('region'), flag: id, x: finite, z: finite, radius: v.pipe(finite, v.minValue(0.01), v.maxValue(500)), when: v.exactOptional(condition) }),
  v.strictObject({ id, kind: v.literal('death'), flag: id, tag: id, when: v.exactOptional(condition) }),
  v.strictObject({ id, kind: v.literal('script'), flag: id, condition: id, when: v.exactOptional(condition) }),
]);
/** A timed run: per player, the ticks from `start` rising to `stop` rising file `fact` with the seconds; past `cap` the run lapses. */
const RACE_CAP_MAX_S = 3600;
const RACE_CAP_MIN_S = 1;
const RACES_MAX = 32;
const raceCap = v.pipe(finite, v.safeInteger(), v.minValue(RACE_CAP_MIN_S), v.maxValue(RACE_CAP_MAX_S));
/** Flags a run's finish and a lapse lower beside `start` and `stop`, so the next run counts them again (a gate line's middle gates). */
const RACE_RESETS_MAX = 64;
const RACE_RESETS_MIN = 1;
const raceResets = v.pipe(v.array(id), v.minLength(RACE_RESETS_MIN), v.maxLength(RACE_RESETS_MAX));
/** Meta MIRROR-SALT-ZONE MSZ31: a race of `laps` laps (1 to 20, default 1); each lap crosses `checkpoints` in order before
 *  `stop` counts it (a lap that misses one is void); `ride` says how it is run (`vehicle`, `foot`, `any`, default `any`): a run
 *  begun the wrong way is refused at `start`. */
const RACE_LAPS_MIN = 1;
const RACE_LAPS_MAX = 20;
const RACE_CHECKPOINTS_MIN = 1;
const RACE_CHECKPOINTS_MAX = 32;
const raceLaps = v.pipe(finite, v.safeInteger(), v.minValue(RACE_LAPS_MIN), v.maxValue(RACE_LAPS_MAX));
const raceCheckpoints = v.pipe(v.array(id), v.minLength(RACE_CHECKPOINTS_MIN), v.maxLength(RACE_CHECKPOINTS_MAX));
const raceRide = v.picklist(['vehicle', 'foot', 'any']);
/** Meta MIRROR-SALT-ZONE MSZ33: a rival who races each run, an AI driver in the vehicle `dock` hands out (its kind and hull), along
 *  `line` (start to stop, x y z; a lap race's line is one lap, closing on its first point), at up to `speed` m/s on a straight
 *  and slower into a bend, eased within `band` m of the player (default 40) so he stays close; a player who finishes ahead
 *  of him raises `beat`. */
const RIVAL_LINE_MIN = 2;
const RIVAL_LINE_MAX = 512;
const RIVAL_SPEED_MIN = 1;
const RIVAL_SPEED_MAX = 80;
const RIVAL_BAND_MIN = 5;
const RIVAL_BAND_MAX = 500;
const rivalPoint = v.tuple([finite, finite, finite]);
const rivalLine = v.pipe(v.array(rivalPoint), v.minLength(RIVAL_LINE_MIN), v.maxLength(RIVAL_LINE_MAX));
const rivalSpeed = v.pipe(finite, v.minValue(RIVAL_SPEED_MIN), v.maxValue(RIVAL_SPEED_MAX));
const rivalBand = v.pipe(finite, v.minValue(RIVAL_BAND_MIN), v.maxValue(RIVAL_BAND_MAX));
const rival = v.strictObject({ name: text, dock: id, line: rivalLine, speed: rivalSpeed, band: v.exactOptional(rivalBand), beat: id });
const race = v.strictObject({ id, start: id, stop: id, fact: id, cap: raceCap, resets: v.exactOptional(raceResets), laps: v.exactOptional(raceLaps), checkpoints: v.exactOptional(raceCheckpoints), ride: v.exactOptional(raceRide), rival: v.exactOptional(rival) });
const raceRows = v.pipe(v.array(race), v.maxLength(RACES_MAX));
const raceList = v.exactOptional(raceRows);
const choice = v.strictObject({ id, label: text, next: v.nullable(id), when: v.exactOptional(condition), sets: v.exactOptional(names), scene: v.exactOptional(id) });
const node = v.strictObject({ id, lines: v.pipe(v.array(text), v.minLength(1), v.maxLength(32)), sets: v.exactOptional(names), choices: v.pipe(v.array(choice), v.maxLength(16)) });
const dialogue = v.strictObject({ id, name: text, start: id, nodes: v.pipe(v.array(node), v.minLength(1), v.maxLength(128)) });
/** Display metadata for the existing achievement registry and ledger; no new progress save. */
const achievement = v.strictObject({ id, name: text, goal: text, count: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(4096)),
  kind: v.exactOptional(id), variant: v.exactOptional(id), event: v.exactOptional(id), title: text, icon: CatalogueIconSchema });
const raw: v.GenericSchema<{ [K in keyof QuestDataInput]: QuestDataInput[K] }, QuestData> = v.strictObject({ achievements: v.exactOptional(v.pipe(v.array(achievement), v.maxLength(256))), flags: names, quests: v.pipe(v.array(quest), v.maxLength(32)), triggers: v.pipe(v.array(trigger), v.maxLength(128)), races: raceList, dialogue: v.pipe(v.array(dialogue), v.maxLength(32)) });
/** Plain quest graphs, declared flags/triggers and finite dialogue trees; hooks name platform-resolved script ports. */

const reads = (c: v.InferOutput<typeof condition> | undefined): string[] => [...(c?.all ?? []), ...(c?.any ?? []), ...(c?.none ?? [])];
/** MSZ31: a race's checkpoints are neither its own start or stop nor named twice, and a lap race has one. */
function checkpointRules(run: { readonly id: string; readonly start: string; readonly stop: string; readonly laps?: number; readonly checkpoints?: readonly string[] }): string[] {
  const checkpoints = run.checkpoints ?? [], errors: string[] = [];
  if (checkpoints.some((flag): boolean => flag === run.start || flag === run.stop)) { errors.push(`race ${run.id} checkpoints its own start or stop`); }
  if (new Set(checkpoints).size !== checkpoints.length) { errors.push(`race ${run.id} names a checkpoint twice`); }
  // A lap counts at the stop only once its checkpoints are crossed, so a lap race without one could be won by stepping over the line
  if ((run.laps ?? RACE_LAPS_MIN) > RACE_LAPS_MIN && checkpoints.length < RACE_CHECKPOINTS_MIN) { errors.push(`race ${run.id} runs laps without checkpoints`); }
  return errors;
}
/** MSZ33: the flags a race reads besides its start, stop and resets: its checkpoints and its rival's beat. */
function raceFlags(run: { readonly checkpoints?: readonly string[]; readonly rival?: { readonly beat: string } }): string[] {
  return run.rival === undefined ? [...run.checkpoints ?? []] : [...run.checkpoints ?? [], run.rival.beat];
}
/** MSZ33: a win over the rival is its own flag, never the line the run starts or stops on. */
function rivalRules(run: { readonly id: string; readonly start: string; readonly stop: string; readonly rival?: { readonly beat: string } }): string[] {
  return run.rival !== undefined && [run.start, run.stop].includes(run.rival.beat) ? [`race ${run.id} beats its rival on its own start or stop`] : [];
}
/** Reject dangling flags, repeated identities, unreachable dialogue nodes and cycles before installing authored data. */
export function questDataRules(data: QuestData): string[] {
  const errors: string[] = [], flags = new Set(data.flags);
  const unique = (ids: readonly string[]): void => { if (new Set(ids).size !== ids.length) errors.push('unique declaration ids'); };
  const checkFlags = (ids: readonly string[]): void => { for (const flag of ids) if (!flags.has(flag)) errors.push(`undeclared quest flag ${flag}`); };
  unique(data.achievements?.map(row => row.id) ?? []); unique(data.flags); unique(data.quests.map((q) => q.id)); unique(data.triggers.map((t) => t.id)); unique(data.dialogue.map((d) => d.id));
  for (const q of data.quests) {
    unique(q.steps.map((s) => s.id)); checkFlags([q.completeFlag, ...reads(q.startWhen)]);
    for (const s of q.steps) checkFlags([...reads(s.done), ...(s.count ?? []), ...(s.markers ?? []).flatMap((m) => reads(m.hideWhen))]);
    for (const m of q.intro?.markers ?? []) checkFlags(reads(m.hideWhen));
  }
  for (const t of data.triggers) checkFlags([t.flag, ...reads(t.when)]);
  const raceIds: string[] = [];
  for (const run of data.races ?? []) {
    raceIds.push(run.id); checkFlags([run.start, run.stop, ...(run.resets ?? [])]);
    if (run.start === run.stop) { errors.push(`race ${run.id} starts and stops on one flag`); }
    if (run.resets?.some((flag): boolean => flag === run.start || flag === run.stop) === true) { errors.push(`race ${run.id} resets its own start or stop`); }
    checkFlags(raceFlags(run)); errors.push(...checkpointRules(run), ...rivalRules(run));
  }
  unique(raceIds);
  for (const d of data.dialogue) {
    unique(d.nodes.map((n) => n.id)); const nodes = new Map(d.nodes.map((n) => [n.id, n])), visited = new Set<string>(), active = new Set<string>();
    const visit = (name: string): void => {
      const n = nodes.get(name); if (n === undefined) { errors.push(`unknown dialogue node ${name}`); return; }
      if (active.has(name)) { errors.push('acyclic dialogue tree'); return; } if (visited.has(name)) return;
      visited.add(name); active.add(name); unique(n.choices.map((c) => c.id)); checkFlags(n.sets ?? []);
      for (const c of n.choices) { checkFlags([...(c.sets ?? []), ...reads(c.when)]); if (c.next !== null) visit(c.next); }
      active.delete(name);
    };
    visit(d.start); if (visited.size !== d.nodes.length) errors.push('reachable dialogue nodes');
  }
  return [...new Set(errors)];
}
/** Serialisable quest/dialogue section with semantic validation in the same admission pass. */
export const QuestDataSchema: v.GenericSchema<{ [K in keyof QuestDataRowsInput]: QuestDataRowsInput[K] }, QuestDataRows> = v.pipe(raw, v.check((data) => questDataRules(data).length === 0, 'valid quest and dialogue graph'));
/** Compile TypeScript-authored rows to validated serialisable quest/dialogue data. */
export function parseQuestData(input: unknown): QuestData { return v.parse(QuestDataSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
interface QuestDataInputFields {
    achievements?: ({
        id: string;
        name: string;
        goal: string;
        count: number;
        kind?: string;
        variant?: string;
        event?: string;
        title: string;
        icon: v.InferInput<typeof CatalogueIconSchema>;
    })[];
    flags: (string)[];
    quests: ({
        id: string;
        title: string;
        track?: boolean;
        completeFlag: string;
        startWhen?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        intro?: {
            objective: string;
            chip?: string;
            hint?: string;
            markers?: ({
                id: string;
                label: string;
                short?: string;
                at: {
                    poi: 'world';
                    x: number;
                    z: number;
                    y?: number;
                };
                hideWhen?: {
                    all?: (string)[];
                    any?: (string)[];
                    none?: (string)[];
                };
            })[];
        };
        steps: ({
            id: string;
            objective: string;
            chip?: string;
            hint?: string;
            done: {
                all?: (string)[];
                any?: (string)[];
                none?: (string)[];
            };
            count?: (string)[];
            feedback?: QuestFeedbackRows;
            markers?: ({
                id: string;
                label: string;
                short?: string;
                at: {
                    poi: 'world';
                    x: number;
                    z: number;
                    y?: number;
                };
                hideWhen?: {
                    all?: (string)[];
                    any?: (string)[];
                    none?: (string)[];
                };
            })[];
        })[];
        onComplete?: {
            fact?: string;
            scene?: string;
            coins?: number;
            payoff?: QuestPayoffRows;
        };
    })[];
    triggers: (({
        id: string;
        kind: 'region';
        flag: string;
        x: number;
        z: number;
        radius: number;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    }) | ({
        id: string;
        kind: 'death';
        flag: string;
        tag: string;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    }) | ({
        id: string;
        kind: 'script';
        flag: string;
        condition: string;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    }))[];
    races?: ({
        id: string;
        start: string;
        stop: string;
        fact: string;
        cap: number;
        resets?: (string)[];
        laps?: number;
        checkpoints?: (string)[];
        ride?: 'vehicle' | 'foot' | 'any';
        rival?: {
            name: string;
            dock: string;
            line: ([number, number, number])[];
            speed: number;
            band?: number;
            beat: string;
        };
    })[];
    dialogue: ({
        id: string;
        name: string;
        start: string;
        nodes: ({
            id: string;
            lines: (string)[];
            sets?: (string)[];
            choices: ({
                id: string;
                label: string;
                next: (string) | null;
                when?: {
                    all?: (string)[];
                    any?: (string)[];
                    none?: (string)[];
                };
                sets?: (string)[];
                scene?: string;
            })[];
        })[];
    })[];
}
export type QuestDataInput = { [Key in keyof QuestDataInputFields]: QuestDataInputFields[Key] };
interface QuestDataFields {
    achievements?: ({
        id: string;
        name: string;
        goal: string;
        count: number;
        kind?: string;
        variant?: string;
        event?: string;
        title: string;
        icon: v.InferOutput<typeof CatalogueIconSchema>;
    })[];
    flags: (string)[];
    quests: ({
        id: string;
        title: string;
        track?: boolean;
        completeFlag: string;
        startWhen?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        intro?: {
            objective: string;
            chip?: string;
            hint?: string;
            markers?: ({
                id: string;
                label: string;
                short?: string;
                at: {
                    poi: 'world';
                    x: number;
                    z: number;
                    y?: number;
                };
                hideWhen?: {
                    all?: (string)[];
                    any?: (string)[];
                    none?: (string)[];
                };
            })[];
        };
        steps: ({
            id: string;
            objective: string;
            chip?: string;
            hint?: string;
            done: {
                all?: (string)[];
                any?: (string)[];
                none?: (string)[];
            };
            count?: (string)[];
            feedback?: QuestFeedbackRows;
            markers?: ({
                id: string;
                label: string;
                short?: string;
                at: {
                    poi: 'world';
                    x: number;
                    z: number;
                    y?: number;
                };
                hideWhen?: {
                    all?: (string)[];
                    any?: (string)[];
                    none?: (string)[];
                };
            })[];
        })[];
        onComplete?: {
            fact?: string;
            scene?: string;
            coins?: number;
            payoff?: QuestPayoffRows;
        };
    })[];
    triggers: (({
        id: string;
        kind: 'region';
        flag: string;
        x: number;
        z: number;
        radius: number;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    }) | ({
        id: string;
        kind: 'death';
        flag: string;
        tag: string;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    }) | ({
        id: string;
        kind: 'script';
        flag: string;
        condition: string;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    }))[];
    races?: ({
        id: string;
        start: string;
        stop: string;
        fact: string;
        cap: number;
        resets?: (string)[];
        laps?: number;
        checkpoints?: (string)[];
        ride?: 'vehicle' | 'foot' | 'any';
        rival?: {
            name: string;
            dock: string;
            line: ([number, number, number])[];
            speed: number;
            band?: number;
            beat: string;
        };
    })[];
    dialogue: ({
        id: string;
        name: string;
        start: string;
        nodes: ({
            id: string;
            lines: (string)[];
            sets?: (string)[];
            choices: ({
                id: string;
                label: string;
                next: (string) | null;
                when?: {
                    all?: (string)[];
                    any?: (string)[];
                    none?: (string)[];
                };
                sets?: (string)[];
                scene?: string;
            })[];
        })[];
    })[];
}
export type QuestData = { [Key in keyof QuestDataFields]: QuestDataFields[Key] };
export type QuestDataRowsInput = QuestDataInput;
export type QuestDataRows = QuestData;
