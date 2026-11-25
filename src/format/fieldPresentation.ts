import * as v from 'valibot';

const number = v.pipe(v.number(),v.finite(),v.minValue(-1e6),v.maxValue(1e6));
const positive = v.pipe(number,v.minValue(.00001));
const count = v.pipe(positive,v.integer(),v.maxValue(4096));
const text = v.pipe(v.string(),v.minLength(1),v.maxLength(8_000_000));
/** Original compressed bytes, inline or in an admitted product file. */
export type GrassPayload = string | {file:string};
const grassFile:v.GenericSchema<unknown,{file:string}> = v.strictObject({file:v.pipe(v.string(),v.maxLength(240),
  v.regex(/^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/u))});
export const GrassPayloadSchema:v.GenericSchema<unknown,GrassPayload> = v.union([text,grassFile]);
const tuple = v.tuple([number,number,number]);
const grid = v.object({ T: positive, G: v.pipe(count,v.maxValue(32)) });
/** QA 11-24 row 70 (J510): the near-field card clumps are optional. A shard without them omits a tier's `cards` and
 *  `scenes.cards`, and the view's third look and `cardsHeight`, all together (`GrassPresentationSchema` checks it). */
const cardRows = v.object({ T: positive, s: positive }), optionalScene = v.exactOptional(GrassPayloadSchema);
const tier = v.object({ rings: v.pipe(v.array(grid),v.minLength(1),v.maxLength(8)), flowers: grid,
  cards: v.exactOptional(cardRows), near: v.tuple([number,number]), per: count,
  channels: v.exactOptional(grassFile),
  scenes: v.object({ blades: GrassPayloadSchema, flowers: GrassPayloadSchema, cards: optionalScene }) });
interface GrassGridRows {T:number;G:number}
type GrassTierSchema = v.ObjectSchema<{
  rings:v.GenericSchema<GrassGridRows[]>;flowers:v.GenericSchema<GrassGridRows>;
  cards:v.ExactOptionalSchema<v.ObjectSchema<{T:v.GenericSchema<number>;s:v.GenericSchema<number>},undefined>,undefined>;
  near:v.GenericSchema<[number,number]>;per:v.GenericSchema<number>;
  channels:v.ExactOptionalSchema<typeof grassFile,undefined>;
  scenes:v.ObjectSchema<{blades:typeof GrassPayloadSchema;flowers:typeof GrassPayloadSchema;cards:v.ExactOptionalSchema<typeof GrassPayloadSchema,undefined>},undefined>;
},undefined>;
interface GrassViewRows {
  looks:[string,string]|[string,string,string];half:number;heightSize:number;heightOrigin:number;lattice:number;
  gain:number;playerRadius:number;cardsHeight?:number;ringHeight:number;
  trail:{speedLimit:number;strength:number};
  gainFalloff:[number,number,number];saturationFalloff:[number,number,number];tintNight:[number,number,number];tintStorm:[number,number,number];
}
type GrassPresentationObject = v.ObjectSchema<{
  height:typeof GrassPayloadSchema;mask:typeof GrassPayloadSchema;field:typeof GrassPayloadSchema;ground:typeof GrassPayloadSchema;
  phone:GrassTierSchema;desktop:GrassTierSchema;view:v.GenericSchema<GrassViewRows>;
},undefined>;
type GrassPresentationType = v.SchemaWithPipe<readonly [GrassPresentationObject,
  v.CheckAction<v.InferOutput<GrassPresentationObject>,string>]>;
/** The card rows `cardsAgree` reads. */
interface CardTierRows { readonly cards?: unknown; readonly scenes: { readonly cards?: unknown } }
interface CardRows { readonly view: { readonly looks: readonly string[]; readonly cardsHeight?: number }; readonly phone: CardTierRows; readonly desktop: CardTierRows }
/** A grass that draws cards names three looks: blades, flowers and the cards. */
const CARD_LOOKS = 3;
const tierAgrees = (profile: CardTierRows, has: boolean): boolean => (profile.cards !== undefined) === has && (profile.scenes.cards !== undefined) === has;
/** Cards are all there or all gone: both tiers' rows and scenes, the third look and `cardsHeight`. */
const cardsAgree = (rows: CardRows): boolean => {
  const has = rows.view.looks.length === CARD_LOOKS;
  return (rows.view.cardsHeight !== undefined) === has && tierAgrees(rows.phone, has) && tierAgrees(rows.desktop, has);
};
/** Bounded camera-ring buffers, lattice and presentation tuning. */
const looks = v.union([v.strictTuple([text,text]),v.strictTuple([text,text,text])]);
const view = v.object({ looks, half: positive, heightSize: count, heightOrigin: number, lattice: positive,
  gain: positive, playerRadius: positive, cardsHeight: v.exactOptional(positive), ringHeight: positive,
  /** the player's trail on the shared trample field: pushes faster than `speedLimit` (m/s, a teleport) are dropped */
  trail: v.object({ speedLimit: positive, strength: positive }),
  gainFalloff: tuple, saturationFalloff: tuple, tintNight: tuple, tintStorm: tuple });
const presentation: GrassPresentationObject = v.object({ height: GrassPayloadSchema, mask: GrassPayloadSchema, field: GrassPayloadSchema, ground: GrassPayloadSchema, phone: tier, desktop: tier, view });
export const GrassPresentationSchema:GrassPresentationType = v.pipe(presentation,
  v.check<v.InferOutput<GrassPresentationObject>, string>(cardsAgree, 'Grass cards are all present (both tiers, the third look, cardsHeight) or all absent'));
export type GrassPresentationRows = v.InferOutput<typeof GrassPresentationSchema>;
/** Selected tier plus shared blocks; an omitted tier retains the complete inventory. */
export function grassPresentationFiles(rows: GrassPresentationRows, selected?: 'phone' | 'desktop'): readonly string[] {
  const tiers = selected === undefined ? [rows.phone, rows.desktop] : [rows[selected]];
  return [...new Set([rows.height,rows.mask,rows.field,rows.ground,
    ...tiers.flatMap(profile => Object.values(profile.scenes)),
    ...tiers.flatMap(profile => profile.channels === undefined ? [] : [profile.channels])]
    .flatMap(row=>typeof row==='string'?[]:[row.file]))];
}
/** Static capture sizes and tuning; the native passes retain their original programs. */
export interface StaticCaptureRows {
  layer:number;shadowSize:{phone:number;desktop:number};contactSize:number;half:number;
  rekeyDegrees:number;heightOrigin:number;heightSize:number;depthBias:number;contact:number;
  staticOffCsm:{phone:boolean;desktop:boolean};
}
/** A level's static capture: its layer, map sizes, bounds and quality rows (the pass programs are the host's). */
export const StaticCaptureSchema:v.GenericSchema<StaticCaptureRows> = v.strictObject({ layer: v.pipe(number,v.integer(),v.minValue(0),v.maxValue(31)),
  shadowSize: v.strictObject({ phone: count, desktop: count }), contactSize: count, half: positive,
  rekeyDegrees: positive, heightOrigin: number, heightSize: positive, depthBias: positive, contact: number,
  staticOffCsm: v.strictObject({ phone: v.boolean(), desktop: v.boolean() }) });
