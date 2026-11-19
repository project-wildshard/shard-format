// These controls deliberately rebuild a real GLB's JSON chunk to pack two species in one file.
/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion */
import { createHash } from 'node:crypto'

import { expect, test } from 'vitest'

import { fixture } from '../ci/skin-variants-fixture.ts'
import { parseGlbData } from './glbCost.ts'
import { parseSkinFile, validateSkinAssets } from './skinAssets.ts'

type Skin = ReturnType<typeof parseSkinFile>
interface GltfNode {
  name?: string
  children?: number[]
  skin?: number
}
interface GltfSkin {
  joints: number[]
  skeleton?: number
}
interface GltfClip {
  channels: { target: { node: number } }[]
}
interface GltfJson {
  nodes: GltfNode[]
  skins: GltfSkin[]
  animations?: GltfClip[]
  scenes: { nodes: number[] }[]
  scene?: number
}

const GLB_JSON_LENGTH = 12
const GLB_JSON_START = 20
const GLB_HEADER = 12
const CHUNK_HEADER = 8
const ALIGN = 4
const SPACE = 0x20
// The JSON chunk type and the GLB magic, 'JSON' and 'glTF' as little-endian words
const JSON_CHUNK = 1_313_821_514
const GLB_MAGIC = 1_179_937_895
const GLB_VERSION = 2
const FIRST = 0
const PAIR = 2

const hash = (value: Uint8Array): string =>
  createHash('sha256').update(value).digest('hex')

function readJson(glb: Uint8Array): { doc: GltfJson; rest: Uint8Array } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
  const length = view.getUint32(GLB_JSON_LENGTH, true)
  const text = glb.subarray(GLB_JSON_START, GLB_JSON_START + length)
  const doc = JSON.parse(new TextDecoder().decode(text)) as GltfJson
  return { doc, rest: glb.subarray(GLB_JSON_START + length) }
}

function writeHeader(out: Uint8Array, padded: number): void {
  const header = new DataView(out.buffer)
  header.setUint32(FIRST, GLB_MAGIC, true)
  header.setUint32(ALIGN, GLB_VERSION, true)
  header.setUint32(ALIGN * PAIR, out.length, true)
  header.setUint32(GLB_HEADER, padded, true)
  header.setUint32(GLB_HEADER + ALIGN, JSON_CHUNK, true)
}

function writeGlb(doc: GltfJson, rest: Uint8Array): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(doc))
  const padded = Math.ceil(text.length / ALIGN) * ALIGN
  const start = GLB_HEADER + CHUNK_HEADER
  const out = new Uint8Array(start + padded + rest.length)
  out.fill(SPACE, start, start + padded)
  writeHeader(out, padded)
  out.set(text, start)
  out.set(rest, start + padded)
  return out
}

function shiftNodes(nodes: GltfNode[], count: number, skins: number): void {
  for (const node of nodes) {
    if (node.children !== undefined) {
      node.children = node.children.map((index): number => index + count)
    }
    if (node.skin !== undefined) {
      node.skin += skins
    }
  }
}

function shiftSkins(skins: GltfSkin[], count: number): void {
  for (const skin of skins) {
    skin.joints = skin.joints.map((index): number => index + count)
    if (skin.skeleton !== undefined) {
      skin.skeleton += count
    }
  }
}

/** A copy of `doc`'s nodes, skins and clips with every node index moved past `doc`'s nodes, and skin past its skins. */
function shifted(doc: GltfJson): {
  nodes: GltfNode[]
  skins: GltfSkin[]
  clips: GltfClip[]
} {
  const copy = structuredClone(doc)
  const count = doc.nodes.length
  shiftNodes(copy.nodes, count, doc.skins.length)
  shiftSkins(copy.skins, count)
  const clips = copy.animations ?? []
  for (const channel of clips.flatMap(
    (clip): GltfClip['channels'] => clip.channels,
  )) {
    channel.target.node += count
  }
  return { nodes: copy.nodes, skins: copy.skins, clips }
}

/**
 * ONE-FORMAT CC51c: the real bandit GLB packed twice into one file, each copy under its own node (`left`, `right`).
 * The copies share the mesh and every accessor; their nodes, joints, sockets and clip names are the same names, so
 * only the packed node tells them apart. `rightClips: false` leaves the right copy without clips.
 */
function pack(glb: Uint8Array, rightClips: boolean): Uint8Array {
  const { doc, rest } = readJson(glb)
  const count = doc.nodes.length
  const copy = shifted(doc)
  const roots = doc.scenes[doc.scene ?? FIRST]?.nodes ?? []
  const right = roots.map((index): number => index + count)
  const packed: GltfJson = Object.assign(structuredClone(doc), {
    nodes: [
      ...doc.nodes,
      ...copy.nodes,
      { name: 'left', children: roots },
      { name: 'right', children: right },
    ],
    skins: [...doc.skins, ...copy.skins],
    animations: [...(doc.animations ?? []), ...(rightClips ? copy.clips : [])],
    scenes: [{ nodes: [count * PAIR, count * PAIR + 1] }],
    scene: FIRST,
  })
  return writeGlb(packed, rest)
}

function fixtureGlb(): Uint8Array {
  const plain = fixture()
  const glb = plain.assets.get(
    parseSkinFile(plain.assets.get(plain.firstHash) ?? new Uint8Array()).row
      .file,
  )
  if (glb === undefined) {
    throw new Error('Missing fixture GLB')
  }
  return glb
}

/** The variant fixture whose `other` skin draws the `right` copy of a packed GLB (`mesh` empty: the whole file). */
function packedFixture(
  mesh: string,
  rightClips = true,
): ReturnType<typeof fixture> {
  const packed = pack(fixtureGlb(), rightClips)
  const cost = parseGlbData(packed)
  const sample = fixture({
    skin: (value: Skin): void => {
      Object.assign(value.row, { file: hash(packed), cost })
      if (mesh !== '') {
        value.row.rig.mesh = mesh
      }
    },
  })
  sample.source.files.push({
    hash: hash(packed),
    kind: 'glb',
    dependencies: [],
    compressed: packed.length,
    ...cost,
    critical: false,
  })
  sample.assets.set(hash(packed), packed)
  return sample
}

function admit(sample: ReturnType<typeof fixture>): void {
  validateSkinAssets(sample.source, sample.assets)
}

test('a skin naming its packed node admits from a GLB of two species with the same names', (): void => {
  expect((): void => {
    admit(packedFixture('right'))
  }).not.toThrow()
})

test('a packed GLB refuses a skin that names no packed node, or one that is not there', (): void => {
  expect((): void => {
    admit(packedFixture(''))
  }).toThrow('expected one skinned mesh')
  expect((): void => {
    admit(packedFixture('middle'))
  }).toThrow('expected one packed node middle')
})

test("a packed skin's clips are only those moving its own nodes", (): void => {
  expect((): void => {
    admit(packedFixture('right', false))
  }).toThrow(/missing or ambiguous clip/u)
})
