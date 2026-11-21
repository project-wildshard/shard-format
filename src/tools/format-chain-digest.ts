import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

// eslint-disable-next-line typescript/strict-void-return -- Node execFile returns a child while its callback supplies the result.
const run = promisify(execFile)
const MAX_OUTPUT = 1_000_000

/** What a fresh Node process prints for a script and its arguments, trimmed (SHARD-COMPAT CP1's two-process check). */
async function freshOutput(
  script: string,
  args: readonly string[],
): Promise<string> {
  const { stdout } = await run(process.execPath, [script, ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
  })
  return stdout.trim()
}

export { freshOutput }
