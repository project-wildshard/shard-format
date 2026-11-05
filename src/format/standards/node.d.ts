// oxlint-disable-next-line import/no-nodejs-modules -- types for Node hosts only; the library never loads this file
import type { TextDecoder as NodeTextDecoder } from 'node:util'

// Node hosts of format (the CLI and the tests). Node's types declare
// TextDecoder as a value only and have no WebAssembly namespace; format
// names both. The library itself is checked against
// format-standards.d.ts instead (tsconfig.lib.json).
declare global {
  type TextDecoder = NodeTextDecoder

  namespace WebAssembly {
    function validate(bytes: Readonly<Uint8Array>): boolean
  }
}
