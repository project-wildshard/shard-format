// What `readTar` and `writeTar` agree a tarball's paths may be. Refused here,
// a hostile path never reaches a disk, on any host a shard is unpacked on.

import { SHARDFILE_ADMISSION_LIMITS } from './admissionLimits.ts'
import { archiveError } from './issue-codes.ts'

// `tar -C product .` adds directories, and a shard adds `shard.json` and
// `validation.json`, to the files its index may list.
const ENTRY_MARGIN = 1024
const MAX_ENTRIES: number = SHARDFILE_ADMISSION_LIMITS.files + ENTRY_MARGIN
const START = 0
const NOT_FOUND = -1
const NEXT = 1
const NUL = 0
const FIRST_PRINTABLE = 32
const DELETE = 127
const BACKSLASH = '\\'

/** What a tarball has claimed so far, folded. */
interface TarClaims {
  readonly files: Set<string>
  readonly folders: Set<string>
}

function newClaims(): TarClaims {
  return { files: new Set<string>(), folders: new Set<string>() }
}

function badPart(part: string): boolean {
  return part === '..' || part === '.' || part === ''
}

function badCharacter(character: string): boolean {
  const code = character.codePointAt(START) ?? NUL
  return character === BACKSLASH || code < FIRST_PRINTABLE || code === DELETE
}

function hasBadCharacter(path: string): boolean {
  for (const character of path) {
    if (badCharacter(character)) {
      return true
    }
  }
  return false
}

function badPath(path: string): boolean {
  return (
    path.startsWith('/') ||
    hasBadCharacter(path) ||
    path.split('/').some((part: string): boolean => badPart(part))
  )
}

/** One spelling for every name Darwin's disk would give one file. */
function folded(path: string): string {
  return path.normalize('NFC').toUpperCase().toLowerCase()
}

function clash(path: string): Error {
  return archiveError(`tar: both a file and a folder: ${path}`)
}

function claimParents(
  claims: Readonly<TarClaims>,
  key: string,
  path: string,
): void {
  for (
    let slash = key.indexOf('/');
    slash !== NOT_FOUND;
    slash = key.indexOf('/', slash + NEXT)
  ) {
    const folder = key.slice(START, slash)
    if (claims.files.has(folder)) {
      throw clash(path)
    }
    claims.folders.add(folder)
  }
}

function claimFile(claims: Readonly<TarClaims>, path: string): void {
  const key = folded(path)
  if (claims.files.has(key)) {
    throw archiveError(`tar: duplicate entry ${path}`)
  }
  if (claims.folders.has(key)) {
    throw clash(path)
  }
  claimParents(claims, key, path)
  claims.files.add(key)
}

function claimFolder(claims: Readonly<TarClaims>, path: string): void {
  const key = folded(path)
  if (claims.files.has(key)) {
    throw clash(path)
  }
  claimParents(claims, key, path)
  claims.folders.add(key)
}

export type { TarClaims }
export { MAX_ENTRIES, badPath, claimFile, claimFolder, newClaims }
