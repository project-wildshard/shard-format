import * as v from 'valibot';
import { isJsonData } from './json.ts';
import { SkinClipNameSchema } from './skinData.ts';
import { ClientChannelsSchema, NumericPoseSchema } from './clientChannels.ts';
import { RidingPresentationSchema } from './riding.ts';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(4096)),number=v.pipe(v.number(),v.finite()),rgb=v.tuple([number,number,number]);
const part=v.tuple([v.number(),v.number(),v.number(),v.array(v.tuple([v.number(),v.number(),v.number()])),v.picklist(['u16','u32'])]);
/** Packed creature bodies in compact form: shared attribute layouts and skeletons, each part [count, indexCount, start,
 *  groups, index]; a species look book expands them to the packed body owner's rows. */
export const CompactSpeciesBodiesSchema: v.GenericSchema<CompactSpeciesBodiesRowsInput, CompactSpeciesBodiesRows>=v.object({file:v.string(),bytes:v.number(),attrs:v.array(v.tuple([v.string(),v.picklist(['f32','u16']),v.number(),v.boolean()])),skeletons:v.array(v.object({bones:v.unknown(),dims:v.unknown()})),
 rows:v.array(v.object({kind:v.string(),variant:v.string(),skeleton:v.number(),fur:v.array(part),hard:v.array(part),eye:v.array(part)}))});

/** G600 L8: a look's channel frame: its `observe` and `surface` programme groups write only private memory (the surface
 *  group also the body's lift) over a per-animal copy of the rig holding `memory`, the smoothed inputs, the death floor
 *  and the head's look angles ([eye height, max yaw, max pitch]); its `pose` group then poses the joints. */
export const LookFrameSchema: v.GenericSchema<LookFrameRowsInput, LookFrameRows> = v.strictObject({ programs: ClientChannelsSchema, surface: text, observe: text, pose: text,
  look: v.tuple([number, number, number]), smooth: v.pipe(v.array(v.strictObject({ input: text, output: text, initial: v.nullable(number) })), v.maxLength(16)),
  floor: v.strictObject({ lift: text, death: text }), memory: v.record(text, number) });
/** Client-only rest looks over an admitted packed body and numeric joint poses. */
export const PackedCreatureLooksSchema: v.GenericSchema<PackedCreatureLooksRowsInput, PackedCreatureLooksRows> = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  poses: v.record(text, NumericPoseSchema), frames: v.optional(v.record(text, LookFrameSchema), {}),
  rows: v.pipe(v.array(v.strictObject({ id: text, species: text, kind: text, skeleton: text,
    sockets: v.array(text), clips: v.array(SkinClipNameSchema), pose: v.exactOptional(text),
    rig: v.exactOptional(v.picklist(['quadruped', 'custom'])), family: v.exactOptional(text),
    // each variant's packed body key, or that key with its coat tints and build traits
    variants: v.exactOptional(v.record(text, v.union([text, v.strictObject({ body: text, tint: v.exactOptional(v.record(text, rgb)),
      traits: v.exactOptional(v.record(text, v.union([number, v.boolean()]))) })]))),
    // G600 L8 / G602 (the hull book's packed looks): a painterly body material, the book's rigged hull skins, the alive /
    // dead post-pose programmes (`poses` ids) with the mount's riding envelopes on the alive one, a stance and a gait
    material: v.exactOptional(v.strictObject({ family: v.literal('painterly'), rim: number, bands: number })),
    hulls: v.exactOptional(v.literal(true)),
    postPose: v.exactOptional(v.strictObject({ alive: text, dead: v.exactOptional(text), envelopes: v.exactOptional(RidingPresentationSchema) })),
    stance: v.exactOptional(v.strictObject({ grazeNeck: number, gallopTail: number })),
    gait: v.exactOptional(v.strictObject({ trot: number, gallop: number })),
    standMem: v.exactOptional(v.record(text, number)), eyeGlow: v.exactOptional(rgb), eyeGlowIntensity: v.exactOptional(number),
    lift: v.exactOptional(v.tuple([number, number, number, number])),
    // the faceted body's per-facet jitter (0: a painted body's flat facets)
    facetJitter: v.exactOptional(v.pipe(number, v.minValue(0))),
    // a hard front: a blow that lands within `arc` degrees of the heading deals `scale` of its damage (flank it)
    hitArc: v.exactOptional(v.strictObject({ arc: v.pipe(number, v.minValue(0), v.maxValue(180)), scale: v.pipe(number, v.minValue(0)) })),
    // the look's own frame: a `poses` programme run as its animate, wearing its attachments (skinned meshes on its body,
    // each a baked geometry of its product in a self-lit colour, named for the views that address it)
    animate: v.exactOptional(text),
    // or a `frames` channel frame run as its animate (never both)
    frame: v.exactOptional(text),
    attachments: v.exactOptional(v.pipe(v.array(v.strictObject({ name: text, file: text, colour: rgb, geometry: v.strictObject({
      attrs: v.pipe(v.array(v.tuple([text, v.picklist(['f32', 'u16']), v.pipe(number, v.integer(), v.minValue(1), v.maxValue(4)), v.boolean()])), v.minLength(1), v.maxLength(8)),
      count: v.pipe(number, v.integer(), v.minValue(1)), index: v.literal('u32'), indexCount: v.pipe(number, v.integer(), v.minValue(3)), box: v.boolean() }) })), v.minLength(1), v.maxLength(4))),
  })), v.maxLength(256)),
}));

const parsedLooks = new WeakMap<object, PackedCreatureLooksRows>();
function freezeLookRows(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  for (const child of Object.values(value)) freezeLookRows(child);
  Object.freeze(value);
}
/** Share only this parser's detached, deeply frozen output. Raw inputs, including
 * frozen authored objects and edited previous inputs, always cross the full schema. */
export function parsePackedCreatureLooks(input: unknown): PackedCreatureLooksRows {
  const known = typeof input === 'object' && input !== null ? parsedLooks.get(input) : undefined;
  if (known !== undefined) return known;
  const rows = v.parse(PackedCreatureLooksSchema, input);
  freezeLookRows(rows);
  parsedLooks.set(rows, rows);
  return rows;
}

/** A product's creature install (G571): the perch body's poses file, the practice spawn its respawn needs, the packed
 *  and hull-book look kinds in install order, the lent graph bodies each look wears and the population projection. */
export const CreatureInstallSchema: v.GenericSchema<CreatureInstallRowsInput, CreatureInstallRows> = v.pipe(v.unknown(), v.check(isJsonData), v.strictObject({
  perch: text, practice: text, projection: text,
  packed: v.strictObject({ file: text, kinds: v.pipe(v.array(text), v.maxLength(64)) }),
  hulls: v.pipe(v.array(text), v.maxLength(64)),
  // the lent body every look wears; `glowing` for a species with an eye glow; `kinds` a kind's own body
  lent: v.strictObject({ body: text, glowing: text, kinds: v.record(text, text) }),
}));
/** An admitted creature install (`actors/creature-install.json`). */

/** Native group slot binding; 0.1 seconds is the fastest admitted decision cadence. */
export const SpeciesGroupSchema: v.GenericSchema<SpeciesGroupRowsInput, SpeciesGroupRows> = v.strictObject({ kind: v.picklist(['pack', 'herd']), clock: text,
  every: v.pipe(number, v.minValue(.1), v.maxValue(10)), confine: v.boolean(), observeDamage: v.boolean(),
  held: v.pipe(v.array(text), v.maxLength(16)), damage: v.exactOptional(text),
});
/** A native director's memory targets and the bounded guest's motion projection. */
export const DirectedSpeciesSchema: v.GenericSchema<DirectedSpeciesRowsInput, DirectedSpeciesRows> = v.strictObject({ signal: text, clock: text,
  every: v.pipe(number, v.minValue(.1), v.maxValue(10)), target: v.tuple([text, text]), motion: v.tuple([text, text]),
  speed: number, turn: number, threshold: number, stopDistance: number, look: number,
  states: v.pipe(v.array(text), v.minLength(1), v.maxLength(32)),
  damage: v.exactOptional(v.strictObject({ signal: text, player: v.tuple([text, text]), radius: number, scale: number, elite: v.boolean() })),
});

/** Admitted data contracts, independent of validator implementation metadata. */
export type CompactSpeciesBodiesRowsInput = CompactSpeciesBodiesRows;
interface CompactSpeciesBodiesRowsFields {
    file: string;
    bytes: number;
    attrs: ([
        string,
        'f32' | 'u16',
        number,
        boolean
    ])[];
    skeletons: ({
        bones: unknown;
        dims: unknown;
    })[];
    rows: ({
        kind: string;
        variant: string;
        skeleton: number;
        fur: ([
            number,
            number,
            number,
            ([
                number,
                number,
                number
            ])[],
            'u16' | 'u32'
        ])[];
        hard: ([
            number,
            number,
            number,
            ([
                number,
                number,
                number
            ])[],
            'u16' | 'u32'
        ])[];
        eye: ([
            number,
            number,
            number,
            ([
                number,
                number,
                number
            ])[],
            'u16' | 'u32'
        ])[];
    })[];
}
export type CompactSpeciesBodiesRows = { [Key in keyof CompactSpeciesBodiesRowsFields]: CompactSpeciesBodiesRowsFields[Key] };
interface LookFrameRowsInputFields {
    programs: v.InferInput<typeof ClientChannelsSchema>;
    surface: string;
    observe: string;
    pose: string;
    look: [
        number,
        number,
        number
    ];
    smooth: ({
        input: string;
        output: string;
        initial: (number) | null;
    })[];
    floor: {
        lift: string;
        death: string;
    };
    memory: Record<string, number>;
}
export type LookFrameRowsInput = { [Key in keyof LookFrameRowsInputFields]: LookFrameRowsInputFields[Key] };
interface LookFrameRowsFields {
    programs: v.InferOutput<typeof ClientChannelsSchema>;
    surface: string;
    observe: string;
    pose: string;
    look: [
        number,
        number,
        number
    ];
    smooth: ({
        input: string;
        output: string;
        initial: (number) | null;
    })[];
    floor: {
        lift: string;
        death: string;
    };
    memory: Record<string, number>;
}
export type LookFrameRows = { [Key in keyof LookFrameRowsFields]: LookFrameRowsFields[Key] };
export type PackedCreatureLooksRowsInput = unknown;
interface PackedCreatureLooksRowsFields {
    poses: Record<string, v.InferOutput<typeof NumericPoseSchema>>;
    frames: Record<string, LookFrameRows>;
    rows: ({
        id: string;
        species: string;
        kind: string;
        skeleton: string;
        sockets: (string)[];
        clips: (v.InferOutput<typeof SkinClipNameSchema>)[];
        pose?: string;
        rig?: 'quadruped' | 'custom';
        family?: string;
        variants?: Record<string, (string) | ({
            body: string;
            tint?: Record<string, [
                number,
                number,
                number
            ]>;
            traits?: Record<string, (number) | (boolean)>;
        })>;
        material?: {
            family: 'painterly';
            rim: number;
            bands: number;
        };
        hulls?: true;
        postPose?: {
            alive: string;
            dead?: string;
            envelopes?: v.InferOutput<typeof RidingPresentationSchema>;
        };
        stance?: {
            grazeNeck: number;
            gallopTail: number;
        };
        gait?: {
            trot: number;
            gallop: number;
        };
        standMem?: Record<string, number>;
        eyeGlow?: [
            number,
            number,
            number
        ];
        eyeGlowIntensity?: number;
        lift?: [
            number,
            number,
            number,
            number
        ];
        facetJitter?: number;
        hitArc?: {
            arc: number;
            scale: number;
        };
        animate?: string;
        frame?: string;
        attachments?: ({
            name: string;
            file: string;
            colour: [
                number,
                number,
                number
            ];
            geometry: {
                attrs: ([
                    string,
                    'f32' | 'u16',
                    number,
                    boolean
                ])[];
                count: number;
                index: 'u32';
                indexCount: number;
                box: boolean;
            };
        })[];
    })[];
}
export type PackedCreatureLooksRows = { [Key in keyof PackedCreatureLooksRowsFields]: PackedCreatureLooksRowsFields[Key] };
export type CreatureInstallRowsInput = unknown;
interface CreatureInstallRowsFields {
    perch: string;
    practice: string;
    projection: string;
    packed: {
        file: string;
        kinds: (string)[];
    };
    hulls: (string)[];
    lent: {
        body: string;
        glowing: string;
        kinds: Record<string, string>;
    };
}
export type CreatureInstallRows = { [Key in keyof CreatureInstallRowsFields]: CreatureInstallRowsFields[Key] };
export type SpeciesGroupRowsInput = SpeciesGroupRows;
interface SpeciesGroupRowsFields {
    kind: 'pack' | 'herd';
    clock: string;
    every: number;
    confine: boolean;
    observeDamage: boolean;
    held: (string)[];
    damage?: string;
}
export type SpeciesGroupRows = { [Key in keyof SpeciesGroupRowsFields]: SpeciesGroupRowsFields[Key] };
export type DirectedSpeciesRowsInput = DirectedSpeciesRows;
interface DirectedSpeciesRowsFields {
    signal: string;
    clock: string;
    every: number;
    target: [
        string,
        string
    ];
    motion: [
        string,
        string
    ];
    speed: number;
    turn: number;
    threshold: number;
    stopDistance: number;
    look: number;
    states: (string)[];
    damage?: {
        signal: string;
        player: [
            string,
            string
        ];
        radius: number;
        scale: number;
        elite: boolean;
    };
}
export type DirectedSpeciesRows = { [Key in keyof DirectedSpeciesRowsFields]: DirectedSpeciesRowsFields[Key] };
