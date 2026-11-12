// `meshoptimizer/decoder` for a Worker (API-CLOUDFLARE AC6a). The Worker's
// bundler (wrangler, esbuild) makes this `.wasm` import a compiled
// WebAssembly.Module, so nothing compiles at runtime, which Workers refuse.
// Bundle with an alias: `meshoptimizer/decoder` -> this file.
import wasm from './meshopt-decoder.wasm'
import { meshoptDecoderFrom } from './meshopt-module.ts'

// oxlint-disable-next-line typescript/no-unsafe-argument -- the bundler types a .wasm import as a compiled module
const MeshoptDecoder = meshoptDecoderFrom(new WebAssembly.Instance(wasm, {}))

export { MeshoptDecoder }
