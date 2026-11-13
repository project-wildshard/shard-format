// oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures edit their own copies
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import { assertAudioAdmission, audioReport } from './audio-rules.ts'
import { issueCodeOf, issueCodeRows } from './issue-codes.ts'
import { performanceReport, prepareAssetDecoders } from './product.ts'
import { validateShardfileProduct } from './productValidation.ts'
import { readTar, writeTar } from './tar.ts'

import type { RecordingMeasure } from './audio-measure.ts'
import type { AudioReport } from './audio-rules.ts'
import type { IssueCode, IssueFamily } from './issue-codes.ts'
import type { ProductFiles, ValidatedProduct } from './productValidation.ts'

// SHARD-AUTHORING SA41: every issue carries a code from the one table, in its family. product-stream.test.ts checks
// that both validators give the same code and words for each refusal; here, the code each check gives.

type Files = ReadonlyMap<string, Uint8Array>
interface Refusal {
  readonly code: IssueCode | undefined
  readonly message: string
}

const CORPUS = new URL('../../corpus/handwritten/', import.meta.url).pathname
const MB = 1_000_000
const TODAY = '2026-11-13'
const LATER = '2099-01-01'
const FAMILY = new Map(
  issueCodeRows().map((row): [string, IssueFamily] => [row.code, row.family]),
)

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function corpusFiles(): Files {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(CORPUS, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = path.join(entry.parentPath, entry.name)
      files.set(
        path.relative(CORPUS, absolute).split(path.sep).join('/'),
        new Uint8Array(readFileSync(absolute)),
      )
    }
  }
  return files
}

/** A host port as the CLI's: a missing file is Node's ENOENT. */
function memoryFiles(files: Files): ProductFiles {
  return {
    read: (file: string, maxBytes: number): Uint8Array => {
      const bytes = files.get(file)
      if (bytes === undefined) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, open '${file}'`),
          { code: 'ENOENT' },
        )
      }
      if (bytes.length > maxBytes) {
        throw new Error(`larger than its declared size: ${file}`)
      }
      return bytes
    },
    paths: (): Iterable<string> => files.keys(),
  }
}

function refusal(run: () => unknown): Refusal {
  try {
    run()
  } catch (error) {
    return {
      code: issueCodeOf(error),
      message: error instanceof Error ? error.message : String(error),
    }
  }
  throw new Error('no refusal')
}

function validated(files: Files): ValidatedProduct {
  return validateShardfileProduct(memoryFiles(files), { hash: sha256 })
}

function without(files: Files, name: string): Files {
  return new Map([...files].filter(([file]): boolean => file !== name))
}

function flipped(bytes: Uint8Array | undefined): Uint8Array {
  const copy = new Uint8Array(bytes ?? [])
  copy[10] = 255 - (copy[10] ?? 0)
  return copy
}

function recording(
  hash: string,
  change: Partial<RecordingMeasure>,
): RecordingMeasure {
  const shape = { channels: 1, sampleRate: 48_000, seconds: 1, kbps: 32 }
  return {
    url: `/assets/sfx/x/${hash}.m4a`,
    hash,
    bytes: 1000,
    role: 'sfx',
    container: 'mp4',
    codec: 'aac',
    ...shape,
    ...change,
  }
}

function budget(bytes: number, waived?: string): AudioReport {
  const waiver =
    waived === undefined
      ? undefined
      : { shard: waived, until: LATER, maxBytes: 20 * MB, reason: 'r' }
  return audioReport([recording('g', { bytes })], {
    slug: 's',
    waiver,
    today: TODAY,
  })
}

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('validator refusals carry the code of the check that refused', (): void => {
  const files = corpusFiles()
  const blob =
    [...files.keys()].find(
      (name): boolean => name.startsWith('blobs/') && name.endsWith('.glb'),
    ) ?? ''
  const section =
    [...files.keys()].find((name): boolean => name.startsWith('sections/')) ??
    ''
  const changed = flipped(files.get(section))
  const longer = new Uint8Array([...(files.get('shard.json') ?? []), 10])

  test.each<[string, Files, IssueCode]>([
    [
      'an unlisted file',
      new Map([...files, ['blobs/extra.bin', new Uint8Array([1])]]),
      'unlisted-file',
    ],
    ['a missing blob (a host ENOENT)', without(files, blob), 'file-mismatch'],
    [
      'a changed section byte',
      new Map([...files, [section, changed]]),
      'file-mismatch',
    ],
    ['no shard.json', without(files, 'shard.json'), 'index-invalid'],
    [
      'non-canonical shard.json',
      new Map([...files, ['shard.json', longer]]),
      'index-invalid',
    ],
  ])('%s: %s', (_name: string, mutated: Files, code: IssueCode): void => {
    const found = refusal((): unknown => validated(mutated))
    expect(found.code).toBe(code)
  })

  test('a host ENOENT keeps its words', (): void => {
    expect(
      refusal((): unknown => validated(without(files, blob))).message,
    ).toMatch(/^ENOENT: /u)
  })

  test('a broken tarball is archive-invalid', (): void => {
    const tar = writeTar(files)
    expect(refusal((): unknown => readTar(tar.slice(0, 700))).code).toBe(
      'archive-invalid',
    )
  })
})

test('performance issues carry a performance code, metric words unchanged', (): void => {
  const { shard } = validated(corpusFiles())
  const scripts = { p95Micros: 0, maxMicros: 0, samples: 0 }
  const report = performanceReport(
    shard,
    { scripts, fuel: { p95: 0, max: 0, samples: 0 } },
    'refuse',
  )
  expect(report.issues.length).toBeGreaterThan(0)
  for (const issue of report.issues) {
    expect(FAMILY.get(issue.code)).toBe('performance')
  }
  const missing = report.issues.find(
    (issue): boolean => issue.code === 'perf-script-samples-missing',
  )
  expect(missing?.metric).toBe('missing execution samples')
})

describe('audio findings carry an audio code', (): void => {
  test('each rule gives its code, and a red report refuses as audio-refused', (): void => {
    const rows = [
      recording('a', { codec: 'unreadable', reason: 'no moov' }),
      recording('h', { codec: 'unreadable', container: 'flac' }),
      recording('b', { reason: 'edts' }),
      recording('c', { codec: 'wav' }),
      recording('d', { sampleRate: 44_100 }),
      recording('e', { seconds: 200 }),
      recording('f', { kbps: 200 }),
      recording('g', { bytes: 11 * MB }),
    ]
    const waiver = {
      shard: 'other',
      until: LATER,
      maxBytes: 20 * MB,
      reason: 'r',
    }
    const report = audioReport(rows, { slug: 's', waiver, today: TODAY })
    expect(
      report.findings.map((finding): string => finding.code).toSorted(),
    ).toEqual([
      'audio-bitrate',
      'audio-budget-red',
      'audio-container',
      'audio-duration',
      'audio-sample-rate',
      'audio-strict-index',
      'audio-unreadable',
      'audio-waiver-invalid',
      'audio-wav',
    ])
    expect(
      refusal((): void => {
        assertAudioAdmission(report)
      }).code,
    ).toBe('audio-refused')
  })

  test('the budget lines', (): void => {
    const findings = [
      ...budget(11 * MB, 's').findings,
      ...budget(7 * MB).findings,
    ]
    expect(findings.map((finding): string => finding.code)).toEqual([
      'audio-budget-waived',
      'audio-budget-amber',
    ])
  })
})
