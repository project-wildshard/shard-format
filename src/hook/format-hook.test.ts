import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// Real Node processes: the hook exists for a loader rule that only a real
// `node_modules` path and a fresh process can show.

const HOOK = fileURLToPath(new URL('format-hook.mjs', import.meta.url))

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'format-hook-'))
  const dir = path.join(root, 'node_modules', '@wildshard', 'lib')
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, 'package.json'),
    '{"name":"@wildshard/lib","type":"module","exports":{".":"./index.ts"}}',
  )
  await writeFile(
    path.join(dir, 'index.ts'),
    'export const answer: number = 42\n',
  )
  return root
}

async function script(root: string, source: string): Promise<string> {
  const file = path.join(root, 'entry.mjs')
  await writeFile(file, source)
  const flags = ['--disable-warning=ExperimentalWarning', file]
  return execFileSync(process.execPath, flags, { encoding: 'utf8' }).trim()
}

const IMPORT_LIB = `
try {
  const { answer } = await import('@wildshard/lib')
  console.log(answer)
} catch (error) {
  console.log(error.code)
}`

test('Node refuses raw TypeScript under node_modules', async (): Promise<void> => {
  const root = await fixture()
  try {
    assert.equal(
      await script(root, IMPORT_LIB),
      'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING',
    )
  } finally {
    await rm(root, { recursive: true })
  }
})

test('the hook lets a dynamic import load it', async (): Promise<void> => {
  const root = await fixture()
  const install = `import { installFormatHook } from ${JSON.stringify(HOOK)}
installFormatHook()
installFormatHook()
${IMPORT_LIB}`
  try {
    assert.equal(await script(root, install), '42')
  } finally {
    await rm(root, { recursive: true })
  }
})
