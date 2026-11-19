import { GrappleClearanceSchema, GrappleModeSchema, GrappleCuesSchema, GrappleFactSchema, GrappleHeadlessSchema, GrappleLooksSchema, type DeclaredGrappleMode, type GrappleMode } from './modes.ts';
import * as v from 'valibot';
/** One baseline HUD hint; tone is admitted before the native tool installs it. */
interface GrappleHint { readonly label: string; readonly icon?: string; readonly tone: string; readonly accent?: string }
/** Client grapple marker, hint, ribbon and burst presentation rows. */
export interface GrappleRows {
  readonly portraitFov: number;
  readonly aim: {
    readonly ribbon: unknown;
    readonly filament: GrappleFilamentUniforms;
    readonly scanPerFrame: number;
    readonly landingStale: number;
    readonly marks: number;
    readonly hints: Readonly<Record<'rest' | 'ready' | 'locked' | 'zip' | 'armed' | 'fire', GrappleHint>>;
    readonly chip: {
      readonly className: string; readonly style: Readonly<Record<string, string>>;
      readonly candidate: string; readonly lockedTouch: string; readonly lockedDesk: string;
      readonly color: string; readonly lockedColor: string;
    };
    readonly mark: { readonly className: string; readonly style: Readonly<Record<string, string>>; readonly glyph: string; readonly color: string };
    readonly toasts: { readonly miss: string; readonly armedTouch: string; readonly armedDesk: string; readonly lockedTouch: string; readonly lockedDesk: string };
    readonly muzzle: readonly number[];
    readonly slack: { readonly fire: number; readonly reel: number; readonly hold: number };
    readonly ropePoints: number; readonly claw: number; readonly halo: number;
    readonly flashes: { readonly muzzle: number; readonly bite: number; readonly dock: number };
    readonly sparks: number; readonly name: string;
    readonly systems: { readonly input: string; readonly rope: string; readonly update: string };
    readonly debug: string;
  };
  readonly bursts: Readonly<Record<'muzzle' | 'bite' | 'dock' | 'sparks', {
    readonly name: string; readonly shape: 'flake' | 'streak'; readonly count: number; readonly life: number;
  }>>;
}

/** A traversable obstacle segment. The native capsule lifts before crossing its plane. */
export interface GrappleClearance {
  readonly axis: 'x' | 'z'; readonly plane: number; readonly min: number; readonly max: number;
  readonly base: number; readonly top: number; readonly ceiling: number;
  readonly owners: readonly string[];
}
/** Anchor coordinates and an optional obstacle clearance; no authored callbacks. */
export interface GrappleCourseRow {
  readonly name: string; readonly hooks: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  readonly mode?: GrappleMode; readonly clearance?: GrappleClearance;
}
/** Tool identity, native observation ids, presentation looks and completion fact. */
export interface GrappleProfile {
  readonly id: string; readonly course: Omit<GrappleCourseRow, 'hooks'>;
  readonly cues: Readonly<Record<'fire' | 'bite' | 'zip' | 'reel' | 'dock', string>>;
  readonly looks: Readonly<Record<'muzzle' | 'bite' | 'dock' | 'sparks' | 'ribbon', string>>;
  readonly fact?: { readonly name: string; readonly entity: string; readonly source: string };
  readonly headless: { readonly step: string; readonly lock: string; readonly aim: string; readonly eye: number; readonly aspect: number; readonly portraitFov: number };
}

const finite = v.pipe(v.number(), v.finite());
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const pair = v.strictObject({ v2: v.tuple([finite, finite]) });
const triple = v.strictObject({ v3: v.tuple([finite, finite, finite]) });
const filamentSchema: v.GenericSchema<GrappleFilamentUniformsInput, GrappleFilamentUniforms> = v.strictObject({ uRes: pair, uProjection: pair, uCorePx: finite, uHaloPx: finite, uI: finite,
  uPulse: finite, uLen: finite, uTime: finite, uCore: triple, uHalo: triple });
/** Exact native ribbon uniform grammar for whole held-view admission. */
export const GrappleFilamentSchema: v.GenericSchema<GrappleFilamentUniformsInput, GrappleFilamentUniforms> = filamentSchema;
/** Admitted ribbon parameters have only the declared numeric/vector keys. */

/** The same authored look parameters serve the native ribbon and its fixture. */
export function parseGrappleFilament(value: unknown): GrappleFilamentUniforms { return v.parse(filamentSchema, value); }
/** Input retains the native mode's original defaults and exact optionals. */
export type GrappleProfileInput = Omit<GrappleProfile, 'course'> & { readonly course: Omit<GrappleProfile['course'], 'mode'> & { readonly mode?: v.InferInput<typeof GrappleModeSchema> } };
/** The complete original native policy, independent of validator metadata. */
export const GrappleProfileSchema: v.GenericSchema<GrappleProfileInput, GrappleProfile> = v.strictObject({
    id, course: v.strictObject({ name: id, mode: v.exactOptional(GrappleModeSchema), clearance: v.exactOptional(GrappleClearanceSchema) }),
    cues: GrappleCuesSchema, looks: GrappleLooksSchema, fact: v.exactOptional(GrappleFactSchema), headless: GrappleHeadlessSchema,
  });
/** Validate identity and physics data before installing the approved native mode. */
export function parseGrappleProfile(value: unknown): GrappleProfile { return v.parse(GrappleProfileSchema, value); }

/** ONE-FORMAT OF41c: the native profile of a plain grapple mode that carries one (`state/modes`), its course mode being
 *  the row's own timings; undefined for a timing-only row. Its hooks, guard and rise stay on the row. */
export function declaredGrappleProfile(row: DeclaredGrappleMode): GrappleProfile | undefined {
  const { profile, hooks: _hooks, guard: _guard, rise: _rise, ...mode } = row;
  if (profile === undefined) return undefined;
  return { id: row.id, course: { ...profile.course, mode }, cues: profile.cues, looks: profile.looks,
    ...(profile.fact === undefined ? {} : { fact: profile.fact }), headless: profile.headless };
}

/** Original complete hook coordinates; the native tool retains their order. */
export const GrappleHooksSchema: v.GenericSchema<readonly { readonly x: number; readonly y: number; readonly z: number }[]> = v.array(v.strictObject({ x: finite, y: finite, z: finite }));

/** Admitted data contracts, independent of validator implementation metadata. */
export type GrappleFilamentUniformsInput = GrappleFilamentUniforms;
interface GrappleFilamentUniformsFields {
    uRes: {
        v2: [
            number,
            number
        ];
    };
    uProjection: {
        v2: [
            number,
            number
        ];
    };
    uCorePx: number;
    uHaloPx: number;
    uI: number;
    uPulse: number;
    uLen: number;
    uTime: number;
    uCore: {
        v3: [
            number,
            number,
            number
        ];
    };
    uHalo: {
        v3: [
            number,
            number,
            number
        ];
    };
}
export type GrappleFilamentUniforms = { [Key in keyof GrappleFilamentUniformsFields]: GrappleFilamentUniformsFields[Key] };
