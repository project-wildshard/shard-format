// One door to the node codecs: compile an encoder or a projected decoder,
// and narrow what they return.

export { compileDecoder, type Decode } from './decode.ts'
export { compileEncoder, type Encode } from './encode.ts'
export {
  asStruct,
  type WireArmValue,
  type WireStruct,
  type WireValue,
} from './values.ts'
