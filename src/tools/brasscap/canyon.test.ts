/* oxlint-disable eslint/max-lines-per-function, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/curly, eslint/id-length, eslint/sort-vars, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion, eslint/max-statements, eslint/max-params, eslint/no-continue, eslint/max-lines -- A byte-level check of a generated GLB: indexed reads into typed arrays, like the generator it tests. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  buildCanyon,
  buildDepot,
  CAMPS,
  canyonWorld,
  depotGeo,
  Geo,
  LEDGE,
  PIT,
  SIDE,
  buildTerrain,
  ROUTES,
  TERRAIN_PARTS,
  terrainGeo,
} from './canyon.ts'

const COMMITTED = new URL(
  '../../../corpus/sources/brasscap-mesa/canyon.glb',
  import.meta.url,
)
const DEPOT = new URL(
  '../../../corpus/sources/brasscap-mesa/depot.glb',
  import.meta.url,
)
const MIB = 1_048_576
const GLB_MAGIC = 0x46_54_6c_67
const JSON_CHUNK = 0x4e_4f_53_4a
const FLOAT = 5126
const HEADER = 12
const CHUNK_HEADER = 8
const UNIT_SLACK = 1e-5

interface Accessor {
  readonly bufferView: number
  readonly componentType: number
  readonly count: number
}
interface Gltf {
  readonly accessors: readonly Accessor[]
  readonly bufferViews: readonly { readonly byteOffset: number }[]
  readonly meshes: readonly {
    readonly primitives: readonly {
      readonly attributes: { readonly NORMAL: number }
    }[]
  }[]
  readonly nodes: readonly { readonly name: string }[]
}

function parse(file: Buffer): { json: Gltf; bin: Buffer } {
  assert.equal(file.readUInt32LE(0), GLB_MAGIC)
  assert.equal(file.readUInt32LE(8), file.length)
  const jsonLength = file.readUInt32LE(HEADER)
  assert.equal(file.readUInt32LE(HEADER + 4), JSON_CHUNK)
  const jsonStart = HEADER + CHUNK_HEADER,
    binStart = jsonStart + jsonLength + CHUNK_HEADER
  return {
    json: JSON.parse(
      file.subarray(jsonStart, jsonStart + jsonLength).toString(),
    ) as Gltf,
    bin: file.subarray(binStart),
  }
}

/** The triangle count of the mesh on the node `name` (flat-shaded: three vertices a triangle). */
function triangles(file: Buffer, name: string): number {
  const { json } = parse(file),
    mesh = json.meshes[json.nodes.findIndex(n => n.name === name)]!
  return json.accessors[mesh.primitives[0]!.attributes.NORMAL]!.count / 3
}

/** The distance from (x, z) to the segment a to b. */
function toSegment(
  x: number,
  z: number,
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    along = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
    t = Math.max(0, Math.min(1, along))
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)
}

/** The committed source GLB of a terrain part. */
function committed(part: string): Buffer {
  return readFileSync(
    new URL(
      `../../../corpus/sources/brasscap-mesa/${part}.glb`,
      import.meta.url,
    ),
  )
}

describe('the Brasscap Mesa canyon generator (BM-1)', (): void => {
  it('writes the same bytes every run, and the committed GLB is its output', (): void => {
    const first = buildCanyon()

    assert.ok(first.equals(buildCanyon()), 'two runs differ')
    assert.ok(
      first.equals(readFileSync(COMMITTED)),
      'corpus/sources/brasscap-mesa/canyon.glb is stale: run node src/tools/brasscap/canyon.ts',
    )
  })

  it('stays under 1 MiB', (): void => {
    assert.ok(buildCanyon().length < MIB)
  })

  it('writes the depot detail GLB the same every run, committed and under 1 MiB (LF2-5)', (): void => {
    const first = buildDepot()

    assert.ok(first.equals(buildDepot()), 'two runs differ')
    assert.ok(
      first.equals(readFileSync(DEPOT)),
      'corpus/sources/brasscap-mesa/depot.glb is stale: run node src/tools/brasscap/canyon.ts',
    )
    assert.ok(first.length < MIB)
    const names = parse(first).json.nodes.map(n => n.name)
    assert.deepEqual(names, ['depot', 'depot.glow'])
  })

  it('folds the depot detail into the bake input, not into its far stand-in (LF2-5)', (): void => {
    const bake = buildCanyon({ bake: true }),
      source = buildCanyon(),
      depot = buildDepot()
    // The bake's canyon adds the skirt's 8 triangles and the depot's detail to the source's canyon, less the plain
    // mesas (LF2-4), which the bake draws as `coarse.mesas` in the L1 tiles only.
    const { shell } = terrainGeo()
    assert.equal(
      triangles(bake, 'canyon'),
      triangles(source, 'canyon') -
        shell.pos.length / 9 +
        8 +
        triangles(depot, 'depot'),
    )
    assert.equal(triangles(bake, 'coarse.mesas'), shell.pos.length / 9)
    assert.equal(
      triangles(bake, 'glow'),
      triangles(source, 'glow') + triangles(depot, 'depot.glow'),
    )
    // The far stand-in is welded from the shell and the skirt alone: one index per source vertex (Codex SHOULD).
    const { json } = parse(bake),
      far = json.meshes[json.nodes.findIndex(n => n.name === 'far.canyon')]!
        .primitives[0] as unknown as { readonly indices: number }
    assert.equal(
      json.accessors[far.indices]!.count / 3,
      triangles(source, 'canyon') + 8,
    )
  })

  it('writes the terrain detail GLBs the same every run, committed and each under 1 MiB (LF2-4)', (): void => {
    for (const part of TERRAIN_PARTS) {
      const first = buildTerrain(part)
      assert.ok(first.equals(buildTerrain(part)), `${part}: two runs differ`)
      assert.ok(
        first.equals(committed(part)),
        `corpus/sources/brasscap-mesa/${part}.glb is stale: run node src/tools/brasscap/canyon.ts`,
      )
      assert.ok(first.length < MIB, part)
    }
  })

  it('bakes the cliffs and ground as L0 detail, the far stand-in from the plain shell alone (LF2-4)', (): void => {
    const bake = buildCanyon({ bake: true })
    const { rock, dress } = terrainGeo()
    assert.equal(
      triangles(bake, 'dress'),
      (rock.pos.length + dress.pos.length) / 9,
    )
  })

  it('keeps everything taller than a step off the routes a player walks (LF2-4)', (): void => {
    const { dress } = terrainGeo()
    for (let v = 0; v < dress.pos.length; v += 3) {
      const [x, y, z] = [dress.pos[v]!, dress.pos[v + 1]!, dress.pos[v + 2]!]
      if (y <= 0.25) continue
      for (const route of ROUTES)
        for (let i = 0; i + 1 < route.length; i += 1)
          assert.ok(
            toSegment(x, z, route[i]!, route[i + 1]!) > 0.3,
            `dressing ${y.toFixed(2)} m tall at (${x.toFixed(1)}, ${z.toFixed(1)}) on a route`,
          )
    }
  })

  it('names the empties the product rows point at', (): void => {
    const names = new Set(parse(buildCanyon()).json.nodes.map(n => n.name))

    for (const mark of [
      'spawn',
      'rack',
      'target.1',
      'target.2',
      'camp.1',
      'camp.2',
      'camp.3',
      'ledge',
      'signpost',
      'gate',
      'wyrm',
    ])
      assert.ok(names.has(mark), mark)
  })

  it('bakes with no sky, the gate door as its own node and a far stand-in', (): void => {
    const names = new Set(
      parse(buildCanyon({ bake: true })).json.nodes.map(n => n.name),
    )
    assert.ok(names.has('gate.door') && names.has('far.canyon'))
    assert.ok(!names.has('sky'))
  })

  it('has only unit normals, so no triangle is degenerate', (): void => {
    for (const { json, bin } of [
      parse(buildCanyon()),
      parse(buildCanyon({ bake: true })),
      parse(buildDepot()),
      ...TERRAIN_PARTS.map(part => parse(buildTerrain(part))),
    ])
      for (const mesh of json.meshes) {
        const accessor = json.accessors[mesh.primitives[0]!.attributes.NORMAL]!
        assert.equal(accessor.componentType, FLOAT)
        const view = json.bufferViews[accessor.bufferView]!,
          normals = new Float32Array(
            bin.buffer.slice(
              bin.byteOffset + view.byteOffset,
              bin.byteOffset + view.byteOffset + accessor.count * 12,
            ),
          )
        for (let i = 0; i < normals.length; i += 3)
          assert.ok(
            Math.abs(
              Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) - 1,
            ) < UNIT_SLACK,
            `normal ${i / 3} is not unit`,
          )
      }
  })

  it('faces box tops up and sides out, so single-sided faces are not culled', (): void => {
    const g = new Geo()
    g.box([0, 0, 0], [2, 1, 2], 0)
    const ys: number[] = []
    for (let i = 1; i < g.nor.length; i += 3) ys.push(g.nor[i]!)

    // Four sides of two triangles (three vertices each), then the four-triangle cap.
    assert.ok(ys.slice(0, 24).every(y => y === 0))
    assert.ok(ys.slice(24).every(y => y === 1))
    const x = g.nor[0]!,
      z = g.nor[2]!
    assert.equal(
      Math.sign(z) * Math.sign(g.pos[2]!),
      1,
      `side normal ${x},${z}`,
    )
  })
})

type P3 = readonly [number, number, number]

/** The distance along `dir` from `from` to the nearest world triangle within `far` (Moller-Trumbore). */
function cast(
  g: Geo,
  from: P3,
  dir: P3,
  far = Infinity,
  front = false,
): number {
  let best = far
  for (let i = 0; i < g.pos.length; i += 9) {
    const a = [g.pos[i]!, g.pos[i + 1]!, g.pos[i + 2]!],
      e1 = [
        g.pos[i + 3]! - a[0]!,
        g.pos[i + 4]! - a[1]!,
        g.pos[i + 5]! - a[2]!,
      ],
      e2 = [g.pos[i + 6]! - a[0]!, g.pos[i + 7]! - a[1]!, g.pos[i + 8]! - a[2]!]
    const p = [
      dir[1] * e2[2]! - dir[2] * e2[1]!,
      dir[2] * e2[0]! - dir[0] * e2[2]!,
      dir[0] * e2[1]! - dir[1] * e2[0]!,
    ]
    const det = e1[0]! * p[0]! + e1[1]! * p[1]! + e1[2]! * p[2]!
    if (Math.abs(det) < 1e-9) continue
    // A front-face cast sees only faces turned toward the ray (their normal e1 x e2 against it).
    const facing =
      dir[0] * (e1[1]! * e2[2]! - e1[2]! * e2[1]!) +
      dir[1] * (e1[2]! * e2[0]! - e1[0]! * e2[2]!) +
      dir[2] * (e1[0]! * e2[1]! - e1[1]! * e2[0]!)
    if (front && facing >= 0) continue
    const t = [from[0] - a[0]!, from[1] - a[1]!, from[2] - a[2]!]
    const u = (t[0]! * p[0]! + t[1]! * p[1]! + t[2]! * p[2]!) / det
    if (u < 0 || u > 1) continue
    const q = [
      t[1]! * e1[2]! - t[2]! * e1[1]!,
      t[2]! * e1[0]! - t[0]! * e1[2]!,
      t[0]! * e1[1]! - t[1]! * e1[0]!,
    ]
    const v = (dir[0] * q[0]! + dir[1] * q[1]! + dir[2] * q[2]!) / det
    if (v < 0 || u + v > 1) continue
    const d = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / det
    if (d > 1e-4 && d < best) best = d
  }
  return best
}

/** The floor under (x, z): the highest up-facing world surface below 40 m. */
const floorAt = (g: Geo, x: number, z: number): number =>
  40 - cast(g, [x, 40, z], [0, -1, 0], Infinity, true)

const camp = (name: string): P3 =>
  CAMPS.find(([id]): boolean => id === name)![1]
const GATE_Z = -62
const PLAYER_STEP = 0.3

describe('the Brasscap Mesa layout (LF2-2)', (): void => {
  const world = canyonWorld()

  it('stands camp 2 on a 6 m ledge, its empty on the flat top', (): void => {
    const [x, y, z] = camp('camp.2')
    assert.equal(y, LEDGE.top)
    // The camp's props stand on the top; this spot off its centre is bare ledge.
    assert.ok(Math.abs(floorAt(world, x - 1.9, z + 1.5 - 4) - LEDGE.top) < 0.01)
    assert.ok(floorAt(world, LEDGE.x0 - 3, z) < 0.1, 'the canyon floor below')
  })

  it('climbs to the ledge top by steps a player can take', (): void => {
    const [zs, zn] = LEDGE.stairZ,
      z = (zs + zn) / 2,
      end = LEDGE.stairX + LEDGE.steps * LEDGE.run
    let last = floorAt(world, LEDGE.stairX - 0.6, z)
    for (let x = LEDGE.stairX - 0.5; x < end; x += 0.1) {
      const y = floorAt(world, x, z)
      assert.ok(
        Math.abs(y - last) <= PLAYER_STEP,
        `a ${(y - last).toFixed(2)} m step at x ${x.toFixed(1)}`,
      )
      last = y
    }
    assert.ok(Math.abs(last - LEDGE.top) < 0.01, 'the stair ends at the top')
    // North of the last step, the ledge top is level ground.
    for (let zz = zn - 0.05; zz > zn - 3; zz -= 0.1)
      assert.ok(
        Math.abs(floorAt(world, end - 0.3, zz) - LEDGE.top) < PLAYER_STEP,
        `at z ${zz.toFixed(1)}`,
      )
  })

  it('keeps camp 3 before the gate, in a side canyon that looks at it', (): void => {
    const [x, , z] = camp('camp.3')
    assert.ok(z > GATE_Z + 6, 'camp 3 is before the gate')
    // Eye to the gate: nothing solid between, past the camp's props and the gate's frame.
    const from: P3 = [x, 1.6, z],
      to: P3 = [SIDE.gate[0], 2.5, SIDE.gate[1] + 0.4]
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]],
      len = Math.hypot(d[0]!, d[1]!, d[2]!)
    const dir: P3 = [d[0]! / len, d[1]! / len, d[2]! / len],
      start: P3 = [
        from[0] + dir[0] * 4,
        from[1] + dir[1] * 4,
        from[2] + dir[2] * 4,
      ]
    assert.equal(cast(world, start, dir, len - 5), len - 5, 'a clear sightline')
    // Rock walls either side of the slot, within 7 m.
    for (const side of [1, -1]) {
      const across: P3 = [-SIDE.u[1] * side, 0, SIDE.u[0] * side]
      assert.ok(cast(world, [x, 3, z], across, 7) < 7, `a wall on side ${side}`)
    }
  })

  it('rings the sand pit with tall rock, open only toward the gate', (): void => {
    const [cx, cz] = PIT.at
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180,
        dir: P3 = [Math.sin(a), 0, Math.cos(a)],
        mouth = deg <= PIT.mouth - 2 || deg >= 360 - PIT.mouth + 2,
        wall = deg >= PIT.mouth + 12 && deg <= 360 - PIT.mouth - 12
      const low = cast(world, [cx, 2, cz], dir, 24),
        high = cast(world, [cx, 12, cz], dir, 24)
      if (wall) {
        assert.ok(low < 20 && high < 20, `rock at ${deg} degrees`)
        assert.ok(low > PIT.floor - 0.5, `the floor is clear at ${deg} degrees`)
      }
      if (mouth) assert.equal(low, 24, `the mouth is open at ${deg} degrees`)
    }
  })
})

describe('the Brasscap Mesa depot, porch and rack (LF2-5)', (): void => {
  const detail = depotGeo()

  it('leaves the walk off the porch clear, east of the posts', (): void => {
    // The play script (lf22-play.mjs) stands the player at (1.2, 1.5) and walks to (1.5, -4): no detail stands there.
    for (let i = 0; i < detail.pos.length; i += 3) {
      const [x, y, z] = [detail.pos[i]!, detail.pos[i + 1]!, detail.pos[i + 2]!]
      assert.ok(
        !(x > 0.75 && x < 2.2 && z > -5 && z < 2 && y > 0.1 && y < 2.5),
        `a vertex at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`,
      )
    }
  })

  it('rests the rifle on the rack board, under the rack empty', (): void => {
    // A ray from the porch at the rack empty's height meets the rifle or the board within a metre.
    const hit = cast(detail, [-2.2, 1.12, 0], [0, 0, -1], 2)
    assert.ok(hit < 1.2, `the rack is ${hit.toFixed(2)} m off`)
  })
})
