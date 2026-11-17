/* oxlint-disable id-length, import/exports-last, import/group-exports, import/no-namespace, no-magic-numbers -- verbatim port of the engine's law (SDK-SPLIT SP4); the stored layout is pinned by golden vectors, so it keeps the engine's form */
/** SDK-SPLIT SP4e (Q35): the stored geometry channel layout moved from engine `client/engine/models/nativeGeometry.ts`; the
 *  three.js restoration (`nativeWholeGeometry`, `restoreDrawnChannels`) stays in the engine. */
import * as v from 'valibot'

/** Portable accessor metadata for one original typed application channel. */
export const NativeAttributeSchema: v.GenericSchema<
  BoundedNativeAttributeInput,
  BoundedNativeAttribute
> = v.strictObject({
  semantic: v.string(),
  storage: v.picklist([
    'Float32Array',
    'Float16Array',
    'Uint16Array',
    'Uint32Array',
    'Int16Array',
    'Int8Array',
    'Uint8Array',
  ]),
  normalized: v.boolean(),
  itemSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)),
})
/** Original application channel names mapped to their exact stored accessors. */
export const NativeAttributesSchema: v.GenericSchema<
  BoundedNativeAttributesInput,
  BoundedNativeAttributes
> = v.record(v.string(), NativeAttributeSchema)

/** Complete admitted data, independent of validator implementation metadata. */
type BoundedNativeAttributeInput = BoundedNativeAttribute
interface BoundedNativeAttributeFields {
  semantic: string
  storage:
    | 'Float32Array'
    | 'Float16Array'
    | 'Uint16Array'
    | 'Uint32Array'
    | 'Int16Array'
    | 'Int8Array'
    | 'Uint8Array'
  normalized: boolean
  itemSize: number
}
export type BoundedNativeAttribute = {
  [Key in keyof BoundedNativeAttributeFields]: BoundedNativeAttributeFields[Key]
}
type BoundedNativeAttributesInput = BoundedNativeAttributes
export type BoundedNativeAttributes = Record<
  string,
  {
    semantic: string
    storage:
      | 'Float32Array'
      | 'Float16Array'
      | 'Uint16Array'
      | 'Uint32Array'
      | 'Int16Array'
      | 'Int8Array'
      | 'Uint8Array'
    normalized: boolean
    itemSize: number
  }
>
