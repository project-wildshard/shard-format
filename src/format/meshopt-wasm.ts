// The SIMD module `meshoptimizer/decoder` carries as packed text, unpacked by
// the decoder's own `unpack` rule (API-CLOUDFLARE AC6a). It is committed as
// meshopt-decoder.wasm for a Worker to import; after a meshoptimizer bump,
// meshopt-module.test.ts fails until it is written again:
//   node -e "import('./src/format/meshopt-wasm.ts').then(m => require('fs').writeFileSync(
//     'src/format/meshopt-decoder.wasm', m.meshoptWasm(require('fs').readFileSync(
//     'node_modules/meshoptimizer/meshopt_decoder.mjs', 'utf8'))))"

const PACKED = /var wasm_simd =\s*'(?<packed>[^']*)'/u
const TABLE = /var wasmpack = new Uint8Array\(\[(?<table>[^\]]*)\]\)/u
const LOWER = 96
const UPPER = 64
const LOWER_BASE = 97
const UPPER_BASE = 39
const DIGIT_SHIFT = 4
const TABLE_CODES = 60
const SPAN = 64
const START = 0
const NEXT = 1

function sixBit(code: number): number {
  if (code > LOWER) {
    return code - LOWER_BASE
  }
  return code > UPPER ? code - UPPER_BASE : code + DIGIT_SHIFT
}

/** The six-bit codes back to bytes: a code under 60 names a table byte, a higher one starts a two-code byte. */
function unpack(
  codes: readonly number[],
  table: readonly number[],
): Uint8Array {
  const out: number[] = []
  for (let at = START; at < codes.length; at += NEXT) {
    const code = codes[at] ?? START
    if (code < TABLE_CODES) {
      out.push(table[code] ?? START)
    } else {
      at += NEXT
      out.push((code - TABLE_CODES) * SPAN + (codes[at] ?? START))
    }
  }
  return Uint8Array.from(out)
}

/** The decoder module's bytes, from the decoder's source text. */
function meshoptWasm(decoderSource: string): Uint8Array {
  const packed = PACKED.exec(decoderSource)?.groups?.['packed']
  const table = TABLE.exec(decoderSource)
    ?.groups?.['table']?.split(',')
    .map(Number)
  if (packed === undefined || table === undefined) {
    throw new Error('meshopt-wasm: the decoder layout changed')
  }
  const codes = Array.from(packed, (letter: string): number =>
    sixBit(letter.codePointAt(START) ?? START),
  )
  return unpack(codes, table)
}

export { meshoptWasm }
