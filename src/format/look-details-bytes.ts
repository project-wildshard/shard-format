/**
 * The binary files behind `look.details` (meta SHARD-SOURCE AP32a), kept binary (engine G649: never base64). Plain
 * arithmetic over bytes, so the same checks run in the browser, the Worker, the cook and Node.
 *
 * - A card mesh file: little-endian, no header: `vertices` × f32 xyz positions, `vertices` × f32 xyz normals, `vertices` ×
 *   f32 uv, then `triangles` × three u16 indices. Its length is exactly `32 × vertices + 6 × triangles` bytes.
 * - A mask file: one u8 per region cell, row by row from the low corner.
 * - A heights file: one u16 little-endian per region cell, the same order.
 */

/** A layer's card mesh: a binary file (by hash) and its counts. */
interface LookDetailMesh {
  readonly file: string
  readonly vertices: number
  readonly triangles: number
}
/** A layer's three files, as bytes. */
interface LookDetailFiles {
  readonly mesh: Readonly<Uint8Array>
  readonly mask: Readonly<Uint8Array>
  readonly heights: Readonly<Uint8Array>
}
/** The parts of a layer row its files are checked against. */
interface DetailFileRow {
  readonly id: string
  readonly mesh: LookDetailMesh
  readonly region: { readonly columns: number; readonly rows: number }
}
/** A card mesh's attribute views over its file's bytes. */
interface LookDetailMeshViews {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array
}

/** At most this many triangles in one layer's card mesh. */
const DETAIL_MESH_TRIANGLES_MAX = 2000
/** At most this many vertices in one layer's card mesh. */
const DETAIL_MESH_VERTICES_MAX = 6000
const NONE = 0
const ONE = 1
const XYZ = 3
const UV = 2
const TRIANGLE = 3
const F32 = 4
const U16 = 2

/** The exact byte length of a card mesh file with these counts. */
function detailMeshBytes(vertices: number, triangles: number): number {
  return vertices * (XYZ + XYZ + UV) * F32 + triangles * TRIANGLE * U16
}

/** The messages whose condition holds. */
function faultsOf(checks: readonly (readonly [boolean, string])[]): string[] {
  return checks
    .filter((entry: readonly [boolean, string]): boolean => entry[NONE])
    .map((entry: readonly [boolean, string]): string => entry[ONE])
}

/** A fresh aligned copy of `length` bytes from `offset`. */
function aligned(
  bytes: Readonly<Uint8Array>,
  offset: number,
  length: number,
): ArrayBuffer {
  return bytes.slice(offset, offset + length).buffer
}

/** The card mesh's attribute views (copied, so any byte offset works). */
function detailMeshViews(
  bytes: Readonly<Uint8Array>,
  mesh: LookDetailMesh,
): LookDetailMeshViews {
  const xyz = mesh.vertices * XYZ * F32
  const uv = mesh.vertices * UV * F32
  return {
    indices: new Uint16Array(
      aligned(bytes, xyz + xyz + uv, mesh.triangles * TRIANGLE * U16),
    ),
    normals: new Float32Array(aligned(bytes, xyz, xyz)),
    positions: new Float32Array(aligned(bytes, NONE, xyz)),
    uvs: new Float32Array(aligned(bytes, xyz + xyz, uv)),
  }
}

/** True when any index is `vertices` or more. */
function indexPast(indices: Readonly<Uint16Array>, vertices: number): boolean {
  return indices.some((index: number): boolean => index >= vertices)
}

/** The faults in one layer's files against its mesh counts and region grid, or none. */
function detailFileFaults(
  row: DetailFileRow,
  files: LookDetailFiles,
): string[] {
  const { id, mesh } = row
  const cells = row.region.columns * row.region.rows
  const meshBytes = detailMeshBytes(mesh.vertices, mesh.triangles)
  const sized = files.mesh.length === meshBytes
  const past =
    sized && indexPast(detailMeshViews(files.mesh, mesh).indices, mesh.vertices)
  return faultsOf([
    [
      !sized,
      `detail ${id}: mesh file holds ${String(files.mesh.length)} bytes, its counts need ${String(meshBytes)}`,
    ],
    [past, `detail ${id}: an index past the last vertex`],
    [
      files.mask.length !== cells,
      `detail ${id}: mask holds ${String(files.mask.length)} bytes, the region has ${String(cells)} cells`,
    ],
    [
      files.heights.length !== cells * U16,
      `detail ${id}: heights hold ${String(files.heights.length)} bytes, the region needs ${String(cells * U16)}`,
    ],
  ])
}

export {
  DETAIL_MESH_TRIANGLES_MAX,
  DETAIL_MESH_VERTICES_MAX,
  detailFileFaults,
  detailMeshBytes,
  detailMeshViews,
  faultsOf,
}
export type {
  DetailFileRow,
  LookDetailFiles,
  LookDetailMesh,
  LookDetailMeshViews,
}
