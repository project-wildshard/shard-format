import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'

// `@wildshard/shard-format` ships raw TypeScript and Node will not strip types
// inside node_modules (J53), so Node-run code loads it through this small
// strip-types hook, applied only under `node_modules/@wildshard/` (J82).
// A static import of a .ts module would link before the hook exists:
// callers install it, then `await import(...)`. A bundle (esbuild, J53)
// has nothing for the hook to do.
//
// This one file is plain JavaScript because it is what makes the .ts files
// loadable: as .ts, nothing could load it from node_modules. Its types are
// in format-hook.d.mts.

const FORMAT_PATH = '/node_modules/@wildshard/'

function loadFormatFile(url) {
  // oxlint-disable-next-line node/no-sync -- module hooks run synchronously
  const source = readFileSync(fileURLToPath(url), 'utf8')
  return {
    format: 'module',
    source: stripTypeScriptTypes(source),
    shortCircuit: true,
  }
}

function createInstaller() {
  const installed = []
  return () => {
    if (installed.length > 0) {
      return
    }
    installed.push(true)
    registerHooks({
      load: (url, context, nextLoad) =>
        url.includes(FORMAT_PATH) && url.endsWith('.ts')
          ? loadFormatFile(url)
          : nextLoad(url, context),
    })
  }
}

/** Install the hook, once per process. */
const installFormatHook = createInstaller()

export { installFormatHook }
