/**
 * The byte checks behind `look.details` (meta SHARD-SOURCE AP32a): base64 sizes, a pure base64 decoder, and the faults in a
 * layer's card mesh. Plain arithmetic, so the same checks run in the browser, the Worker and Node.
 */

/** A layer's card mesh, base64 little-endian. */
interface LookDetailMesh {
  readonly positions: string
  readonly normals: string
  readonly uvs: string
  readonly indices?: string
}

/** At most this many triangles in one layer's card mesh. */
const DETAIL_MESH_TRIANGLES_MAX = 2000
const NONE = 0
const ONE = 1
const BINARY = 2
const F32_XYZ_BYTES = 12
const F32_UV_BYTES = 8
const U16_BYTES = 2
const TRIANGLE_INDEX_BYTES = 6
const TRIANGLE_VERTICES = 3
const QUAD_CHARS = 4
const QUAD_BYTES = 3
const SEXTET = 64
const OCTET = 256
const SEXTET_BITS = 6
const OCTET_BITS = 8
const PAIR_SPARE_BITS = SEXTET_BITS * BINARY - OCTET_BITS
const PADDING = /[=]+$/u
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** The byte length a padded base64 string decodes to. */
function base64Bytes(text: string): number {
  const padding = text.length - text.replace(PADDING, '').length
  return (text.length / QUAD_CHARS) * QUAD_BYTES - padding
}

/** Byte `index` of the bit stream the sextets spell. */
function byteAt(sextets: readonly number[], index: number): number {
  const bit = index * OCTET_BITS
  const first = Math.floor(bit / SEXTET_BITS)
  const pair =
    (sextets[first] ?? NONE) * SEXTET + (sextets[first + ONE] ?? NONE)
  return (
    Math.floor(pair / BINARY ** (PAIR_SPARE_BITS - (bit % SEXTET_BITS))) % OCTET
  )
}

/** Decode padded base64 to bytes (pure arithmetic, so it runs in any host). */
function decodeBase64(text: string): Uint8Array {
  const sextets = Array.from(
    text.replace(PADDING, ''),
    (char: string): number => ALPHABET.indexOf(char),
  )
  return Uint8Array.from(
    { length: base64Bytes(text) },
    (_unused: unknown, index: number): number => byteAt(sextets, index),
  )
}

/** True when any u16 in `bytes` is `vertices` or more. */
function indexPast(bytes: Readonly<Uint8Array>, vertices: number): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let past = false
  for (let offset = NONE; offset < bytes.length; offset += U16_BYTES) {
    past ||= view.getUint16(offset, true) >= vertices
  }
  return past
}

/** The messages whose condition holds. */
function faultsOf(checks: readonly (readonly [boolean, string])[]): string[] {
  return checks
    .filter((entry: readonly [boolean, string]): boolean => entry[NONE])
    .map((entry: readonly [boolean, string]): string => entry[ONE])
}

/** The triangles in a mesh and its index faults. */
function indexFaults(
  id: string,
  mesh: LookDetailMesh,
  vertices: number,
): { readonly triangles: number; readonly faults: string[] } {
  if (mesh.indices === undefined) {
    const loose = vertices % TRIANGLE_VERTICES !== NONE
    return {
      faults: faultsOf([
        [loose, `detail ${id}: a triangle list has a multiple of 3 vertices`],
      ]),
      triangles: vertices / TRIANGLE_VERTICES,
    }
  }
  const bytes = decodeBase64(mesh.indices)
  if (bytes.length === NONE || bytes.length % TRIANGLE_INDEX_BYTES !== NONE) {
    return {
      faults: [`detail ${id}: indices are whole u16 triangles`],
      triangles: NONE,
    }
  }
  const past = indexPast(bytes, vertices)
  return {
    faults: faultsOf([[past, `detail ${id}: an index past the last vertex`]]),
    triangles: bytes.length / TRIANGLE_INDEX_BYTES,
  }
}

/** The faults in one layer's card mesh, or none. */
function meshFaults(id: string, mesh: LookDetailMesh): string[] {
  const positions = base64Bytes(mesh.positions)
  const vertices = positions / F32_XYZ_BYTES
  const indexed = indexFaults(id, mesh, vertices)
  const triangles = Math.floor(indexed.triangles)
  return [
    ...faultsOf([
      [
        positions === NONE || positions % F32_XYZ_BYTES !== NONE,
        `detail ${id}: positions are whole f32 xyz triples`,
      ],
      [
        base64Bytes(mesh.normals) !== positions,
        `detail ${id}: one normal per vertex`,
      ],
      [
        base64Bytes(mesh.uvs) !== vertices * F32_UV_BYTES,
        `detail ${id}: one uv per vertex`,
      ],
      [
        triangles > DETAIL_MESH_TRIANGLES_MAX,
        `detail ${id}: ${String(triangles)} card triangles, at most ${String(DETAIL_MESH_TRIANGLES_MAX)}`,
      ],
    ]),
    ...indexed.faults,
  ]
}

export {
  DETAIL_MESH_TRIANGLES_MAX,
  base64Bytes,
  decodeBase64,
  faultsOf,
  meshFaults,
}
export type { LookDetailMesh }
