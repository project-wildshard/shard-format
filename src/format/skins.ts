import * as v from 'valibot';
import { CreatureSkinClipNameSchema } from './skinData.ts';
import type { CreatureSkinClipName } from './skinData.ts';

/** The look recipe for an exported skin, and its animation recipe. */
const SKIN_LOOK_RECIPE = 'platform.skin';
/** The animation recipe that consumes the exported skin clip parameters. */
const SKIN_CLIPS_RECIPE = 'platform.clips';
const hash = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u));
/** The look row's parameters. A phone file is a single skin unless variants names the desktop table; then phone names the phone table. */
const SkinLookParametersSchema: v.GenericSchema<SkinLookParametersRowsInput, SkinLookParametersRows> = v.strictObject({ skin: hash, variants: v.exactOptional(hash), phone: v.exactOptional(hash) });
/** Complete variant-to-skin declarations in one ordinary content-addressed JSON file. */
const VARIANTS_VERSION = 1;
const MIN_VARIANTS = 1;
const MAX_VARIANTS = 64;
const MAX_VARIANT_LENGTH = 128;
const variantId = v.pipe(v.string(), v.minLength(MIN_VARIANTS), v.maxLength(MAX_VARIANT_LENGTH));
const variantSkins = v.pipe(v.record(variantId, hash), v.minEntries(MIN_VARIANTS), v.maxEntries(MAX_VARIANTS));
interface SkinVariantsFields { version: typeof VARIANTS_VERSION; skins: Record<string, string> }
type SkinVariants = { [Key in keyof SkinVariantsFields]: SkinVariantsFields[Key] };
const SkinVariantsSchema: v.GenericSchema<SkinVariants> = v.strictObject({ version: v.literal(VARIANTS_VERSION),
  skins: variantSkins });
type SkinClipState = 'idle' | 'idle.graze' | 'walk' | 'attack' | 'hit' | 'die';
interface SkinClipMap<Name extends string = CreatureSkinClipName> {
  states?: Partial<Record<SkinClipState, Name>>;
  abilities?: Record<string, Name>;
}
const MAX_ABILITY_ID = 128;
const MAX_ABILITY_CLIPS = 32;
const clipSlot = v.exactOptional(CreatureSkinClipNameSchema);
const abilityName = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(MAX_ABILITY_ID));
const stateClips = v.strictObject({
  idle: clipSlot, 'idle.graze': clipSlot, walk: clipSlot, attack: clipSlot, hit: clipSlot, die: clipSlot,
});
const abilityClips = v.pipe(v.record(abilityName, CreatureSkinClipNameSchema), v.maxEntries(MAX_ABILITY_CLIPS));
const SkinClipMapSchema: v.GenericSchema<SkinClipMap<string>, SkinClipMap> = v.strictObject({
  states: v.exactOptional(stateClips),
  abilities: v.exactOptional(abilityClips),
});
/** The animation recipe's parameters. */
const SkinClipParametersSchema: v.GenericSchema<SkinClipParametersRowsInput, SkinClipParametersRows> = v.strictObject({ attackSpan: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.05), v.maxValue(10)), 1) });
/** The content-addressed skin file: one export row and its binding (validated together by the SF9c parsers). */
const ShardSkinFileSchema: v.GenericSchema<ShardSkinFileRowsInput, ShardSkinFileRows> = v.strictObject({ row: v.unknown(), binding: v.unknown() });

/** A parsed skin look: the file it names and the attack span its clip was sampled with. */
/** `phone` (ONE-FORMAT CC51b) names a lighter skin file the phone tier draws instead: same rig, clips, sockets and material. */
interface SkinLookParameters { skin: string; variants?: string; phone?: string; attackSpan: number; clipMap?: SkinClipMap }

/** Admitted data contracts, independent of validator implementation metadata. */
type SkinLookParametersRowsInput = SkinLookParametersRows;
interface SkinLookParametersRowsFields {
    skin: string;
    variants?: string;
    phone?: string;
}
type SkinLookParametersRows = { [Key in keyof SkinLookParametersRowsFields]: SkinLookParametersRowsFields[Key] };
interface SkinClipParametersRowsInputFields {
    attackSpan?: number | undefined;
}
type SkinClipParametersRowsInput = { [Key in keyof SkinClipParametersRowsInputFields]: SkinClipParametersRowsInputFields[Key] };
interface SkinClipParametersRowsFields {
    attackSpan: number;
}
type SkinClipParametersRows = { [Key in keyof SkinClipParametersRowsFields]: SkinClipParametersRowsFields[Key] };
type ShardSkinFileRowsInput = ShardSkinFileRows;
interface ShardSkinFileRowsFields {
    row: unknown;
    binding: unknown;
}
type ShardSkinFileRows = { [Key in keyof ShardSkinFileRowsFields]: ShardSkinFileRowsFields[Key] };

export { SKIN_LOOK_RECIPE, SKIN_CLIPS_RECIPE, SkinLookParametersSchema, type SkinVariants, SkinVariantsSchema, SkinClipParametersSchema, SkinClipMapSchema, ShardSkinFileSchema, type SkinClipMap, type SkinClipState, type SkinLookParameters, type SkinLookParametersRowsInput, type SkinLookParametersRows, type SkinClipParametersRowsInput, type SkinClipParametersRows, type ShardSkinFileRowsInput, type ShardSkinFileRows };
