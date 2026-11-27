import { assertShardMountUrls, assertStandaloneArt, readDiscoveryArt } from './standalone-art.ts';
import { cookMountPath, readCookData } from './cook-data.ts';
import type { CookData, CookMount } from './cook-data.ts';
import { checkDiscoveryMount, isDiscoveryMount } from './manifest-deprecations.ts';
import { isPreparedCook, requireCookPreparation } from './cook-preparation.ts';
import { declaredSourceMatches, parseIncomingIndex, validateIncomingSection } from './incoming.ts';
import { assembleOutputShardfile, type OutputFile, type OutputIndex } from './outputIndex.ts';
import { decisionModuleContracts, scriptAdmissionRows, type ScriptAdmissionRows, type ScriptContract } from './scriptContract.ts';
import { registeredJsonContract, validateRegisteredJson } from './registeredJson.ts';
import { validatePlatformFile } from './platformFileFamilies.ts';
import { parseNamedJson } from './json.ts';
import { ktx2DeviceCosts } from './ktx2Cost.ts';
import { isTerrainTileData } from './terrainTileBytes.ts';
import { parseImageAsset } from './stillImage.ts';
import { parseWorldTargets, worldTargetRules } from './worldTargets.ts';
import { parseShardfile, type Shardfile } from './shardSchema.ts';
import { assetCost, offlineMemoryAdmission, performanceTargetIssues } from './shardfile-assets.ts';
import { preflightDeclaredCosts, validateShardfileAssets } from './assetAdmission.ts';
import { validationSourceBytes } from './validationReceipt.ts';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits.ts';
import { assetStore, checkPacks, mountSharesBlob } from './shardfile-reads.ts';
import { assertSectionSides } from './feature-sides.ts';
import { assertScriptSides } from './script-sides.ts';
import { shardfileRecordings } from './shardfile-audio.ts';
import type { RecordingMeasure } from './audio-measure.ts';
import { issueError, withIssueCode as coded } from './issue-codes.ts';
import { phoneCopyWarnings } from './phone-copy-warnings.ts';
import { staleRuntimeIssues } from './memory-epoch.ts';
import { memoryContext, offlineMemoryIssues } from './memory-line.ts';
import { armedZone } from './memory-armed.ts';
import { runtimeTierIssues } from './runtime-tier.ts';
import type { MemoryContext } from './memory-line.ts';
import { mountedImageBytes, mountedImageOnPhone, NO_BYTES } from './boot-memory-cost.ts';
import { admittedVerdict, policyVerdict, recordVerdict } from './policy-verdict.ts';
import type { Judged, PolicyVerdict } from './policy-verdict.ts';
import { deprecationReport } from './deprecations.ts';
import { refuseCarriedKtx2 } from './carried-ktx2.ts';
import { currentSchemaSource } from './schema-source.ts';
import type { DeprecationReport } from './deprecations.ts';

/**
 * P1-F3 format validation of a built shardfile product (format 2: `shard.json`, sections, blobs, packs): the schema,
 * the exact file inventory, hashes and sizes, byte kinds, declared costs, budgets and script admission rows. It needs
 * only this package. It never executes script bytes: re-running admitted WASM (G491) is the execution proof, which
 * stays with the author CLI and the cook worker.
 *
 * Call `prepareAssetDecoders()` (`@wildshard/shard-format/shardfileAssets`) once before validating; GLB costs need the decoder.
 */

/** Read access to one product folder. Paths are `/`-separated and relative to the product root. */
export interface ShardfileFiles {
  /** The bytes of one regular file, refusing symlinks and anything larger than `maxBytes`. */
  readonly read: (path: string, maxBytes: number) => Uint8Array;
  /** Every non-directory entry under the root (symlinks and special files included, so they are refused as unlisted). */
  readonly paths: () => Iterable<string>;
}

/** The host services format validation needs but does not own. */
export interface ShardfileValidationPorts {
  /** Lowercase hex SHA-256 of exact bytes. */
  readonly hash: (bytes: Uint8Array) => string;
  /** Whether bytes have the expected hash; `whole` marks a complete inventory file a caller may remember. Default: `hash`. */
  readonly verify?: (bytes: Uint8Array, expected: string, whole: boolean) => boolean;
  /** Extra JSON Schema check of a named blob against its embedded `jsonSchema` (the author SDK runs Ajv). Registered names
   *  are always parsed by their defining format schema; an unregistered name with an embedded schema needs this port. */
  readonly definedJson?: (schemaBytes: Uint8Array, bytes: Uint8Array, name: string | undefined) => void;
  /** Import check for a copied `runtime/` file (the retired copied-runtime arm). Without it such files are refused. */
  readonly runtimeImports?: (path: string, source: string) => void;
  /** SHARD-COMPAT CP10: `'stored'` for a shard file already admitted (a stored original, an engine pin, a cook): memory
   *  and budget policy only reports, since it was judged at upload. Default `'upload'`: the policy refuses. */
  readonly judged?: Judged;
  /** FORMAT-PRUNE FP27b: whether the API catalogue arms this shard (`/api/catalogue` `armed`). Admission passes it; absent,
   *  the shard is not armed: since FP27c the format keeps no list. */
  readonly armed?: boolean | ReadonlySet<string> | undefined;
  /** D31: hold no file's bytes between checks. `assets`, here and in the result, reads each file again from `files`, so a
   *  host's peak is its largest file rather than the shard, at the cost of those repeat reads. */
  readonly readThrough?: boolean;
  /** SHARD-COMPAT CP1: `'migrated'` for a migrated copy (`validateMigrated`), whose author preparation a render step may
   *  have left stale for the box's cook; the preparation check is skipped. Default `'author'`. */
  readonly preparation?: 'author' | 'migrated';
}

/** A product that passed format validation. */
export interface ValidatedShardfile extends DeprecationReport {
  readonly index: OutputIndex;
  readonly shard: Shardfile;
  /** Admitted bytes by hash (`commons:<hash>` for pinned commons). */
  readonly assets: ReadonlyMap<string, Uint8Array>;
  /** The parsed section payloads by section name. */
  readonly sections: ReadonlyMap<string, unknown>;
  /** The script admission rows the product was admitted with. */
  readonly scripts: ScriptAdmissionRows;
  /** CP10: the policy verdict and its rule version, for the API to store beside an upload. */
  readonly policy: PolicyVerdict;
  /** AUDIO AU5: the shard's own recordings (audio mounts and non-commons `audio.recordings`), measured from their bytes. */
  readonly audio: readonly RecordingMeasure[];
}

const decoder = (): TextDecoder => new TextDecoder('utf-8', { fatal: true });

/** Parse canonical JSON bytes (sorted keys, one trailing newline), refusing any other encoding of the same value. */
export function readCanonicalJson(bytes: Uint8Array): unknown {
  const text = decoder().decode(bytes), value: unknown = JSON.parse(text);
  if (decoder().decode(validationSourceBytes(value)) !== text) throw new Error('Output JSON must use canonical encoding');
  return value;
}

/** The output kind of an asset's bytes, from its declared shardfile kind (`commons` sniffs the bytes). */
export function outputBlobKind(kind: string, bytes: Uint8Array): OutputFile['kind'] {
  if (kind === 'binary') return isTerrainTileData(bytes) ? 'tile' : 'bin';
  if (kind === 'commons') {
    const head = new TextDecoder().decode(bytes.subarray(0, 4));
    if (head === 'glTF') return 'glb'; if (bytes[0] === 171) return 'ktx2';
    if (head === 'RIFF' || new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp') return 'audio';
    return isTerrainTileData(bytes) ? 'tile' : 'bin';
  }
  if (kind === 'glb' || kind === 'ktx2' || kind === 'audio' || kind === 'json' || kind === 'wasm' || kind === 'image') return kind;
  throw new Error('Unsupported output asset kind');
}

/** The file extension an output blob of this kind and these bytes is written with. */
export function outputBlobExtension(kind: OutputFile['kind'], bytes: Uint8Array): string {
  if (kind === 'tile') return 'wtt';
  if (kind === 'image') return { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[parseImageAsset(bytes).mime];
  if (kind === 'audio') {
    const head = new TextDecoder().decode(bytes.subarray(0, 4));
    if (head === 'RIFF') return 'wav'; if (head === 'OggS') return 'ogg';
    if (new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp') return 'm4a';
    return 'mp3';
  }
  return kind;
}

/** Refuse the declared targets a policy treats as refusals, before any byte is read or executed; return the verdict.
 *  A stored shard file (CP10, the context's `judged`) is never refused here: it was judged at its upload. */
export function assertShardfileTargets(source: Shardfile, policy: 'warn' | 'refuse', context: MemoryContext = new Map()): PolicyVerdict {
  // J412: the memory gates are ratchets; an issue in a zone not armed reports (`memory-armed.ts`) and is not thrown here.
  const { armed } = memoryContext(context);
  const found = [...staleRuntimeIssues(source.runtime, undefined, { ...source.identity, armed }), ...offlineMemoryIssues(source, context), ...runtimeTierIssues(source, armed), ...performanceTargetIssues(source, policy)];
  const issues = found.filter(issue => issue.severity === 'refusal'), judged = memoryContext(context).judged ?? 'upload';
  if (issues.length > 0 && judged === 'upload') throw issueError('performance-targets', issues.map(issue => `REFUSAL: ${issue.metric}: ${issue.actual} > ${issue.limit}`).join('\n'));
  return policyVerdict(armedZone(source.identity.slug, armed), judged, found);
}

/** Admit a whole shardfile's declared costs and its actual immutable bytes through the defining contracts. */
export function admitShardfileFolder(input: unknown, assets: ReadonlyMap<string, Uint8Array>, hash: (bytes: Uint8Array) => string,
  policy: 'warn' | 'refuse' = 'refuse', scripts: ScriptAdmissionRows = [], context?: MemoryContext): Shardfile {
  const { sections, judged, armed } = context === undefined ? { sections: undefined, judged: undefined, armed: undefined } : memoryContext(context);
  const source = coded('shard-schema', (): Shardfile => parseShardfile(input, sections));
  coded('declared-costs', (): void => { preflightDeclaredCosts(source, offlineMemoryAdmission(policy, judged, armed)); });
  const verdict = coded('performance-targets', (): PolicyVerdict => assertShardfileTargets(source, policy, context));
  return recordVerdict(coded('asset-admission', (): Shardfile => validateShardfileAssets(source, assets, hash, offlineMemoryAdmission(policy, judged, armed), undefined, scripts, sections)), verdict);
}

/** Refuse world target rows that name items or quests the shardfile does not declare. */
export function checkWorldTargets(source: Shardfile, input: unknown): void {
  if (input === undefined) return;
  const errors = coded('world-targets', (): string[] => worldTargetRules(parseWorldTargets(input), source));
  if (errors.length > 0) throw issueError('world-targets', errors.join('; '));
}

function inspectBlob(file: OutputFile, bytes: Uint8Array, ports: ShardfileValidationPorts, script?: ScriptContract): void {
  const contract = file.name === undefined ? undefined : registeredJsonContract(file.name);
  if (contract !== undefined && (file.kind !== 'json' || file.jsonSchema === undefined)) throw new Error('Registered JSON requires its defining schema');
  if (file.jsonSchema !== undefined) {
    if (ports.definedJson !== undefined) ports.definedJson(validationSourceBytes(file.jsonSchema), bytes, file.name);
    else if (contract === undefined || file.name === undefined) throw new Error('Unregistered named JSON with a schema needs a JSON Schema checker');
    else {
      if (currentSchemaSource(file.jsonSchema['$comment']) !== contract.source) throw new Error('Registered JSON requires its exact defining format contract');
      validateRegisteredJson(file.name, parseNamedJson(bytes));
    }
  }
  if (file.kind === 'json' && file.name !== undefined) {
    const source = file.jsonSchema?.['$comment'];
    if (validatePlatformFile(file.name, typeof source === 'string' ? source : undefined, parseNamedJson(bytes)) === undefined) throw new Error(`Unregistered named JSON: ${file.name}`);
  }
  const legacy = file.kind === 'bin' || file.kind === 'tile' ? 'binary' : file.kind;
  if (outputBlobKind(legacy, bytes) !== file.kind || !file.path.endsWith(`.${outputBlobExtension(file.kind, bytes)}`)) throw new Error('Output blob bytes differ from their declared kind');
  const cost = assetCost(legacy, bytes, script);
  if ((['decoded', 'gpu', 'triangles', 'draws'] as const).some(key => cost[key] > file[key])) throw new Error('Output blob understates parsed costs');
}

type ReadListed = (entry: Readonly<{ path: string; hash: string; bytes: number }>) => Uint8Array;

/** Each section: listed, canonical, a declared side, its schema (`section-invalid`). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
function readSections(index: OutputIndex, read: ReadListed): Map<string, unknown> {
  const payloads = new Map<string, unknown>();
  for (const entry of index.sections) {
    coded('section-invalid', (): void => { const value = readCanonicalJson(read(entry)); assertSectionSides(entry.name, value); validateIncomingSection(entry.name, value); payloads.set(entry.name, value); });
  }
  return payloads;
}

/** J91: server files pass the same hash, size and schema checks; they stay out of the client's admitted assets. Then the
 *  declared KTX2 device costs against the verified bytes. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type and the admitted bytes, only read
function checkServerAndKtx2(index: OutputIndex, read: ReadListed, assets: ReadonlyMap<string, Uint8Array>): void {
  for (const entry of index.admission.server ?? []) {
    const bytes = read(entry);
    coded('server-file-invalid', (): void => {
      if (entry.kind === 'json') {
        if (validatePlatformFile(entry.name, entry.schema, readCanonicalJson(bytes)) === undefined) throw new Error(`Unregistered named JSON: ${entry.name}`);
      } else if (outputBlobKind('binary', bytes) !== entry.kind) throw new Error('Output blob bytes differ from their declared kind');
    });
  }
  coded('ktx2-costs', (): void => {
    for (const [hash, cost] of Object.entries(index.ktx2Costs ?? {})) {
      const bytes = assets.get(hash);
      if (bytes === undefined || decoder().decode(validationSourceBytes(cost)) !== decoder().decode(validationSourceBytes(ktx2DeviceCosts(bytes)))) throw new Error('KTX2 device costs differ from verified bytes');
    }
  });
}

type MountInventory = Readonly<{ formatVersion: OutputIndex['formatVersion']; files: readonly Readonly<Pick<OutputFile, 'hash' | 'path' | 'compressed'>>[] }>;

/** C0 (J137): verify every cook mount, even a desktop image the phone never requests. */
function checkedMountImageBytes(index: MountInventory, mount: Readonly<CookMount>, options: Readonly<{ read: ReadListed; onPhone: boolean }>): number {
  if (mountSharesBlob(mount, index.files)) { return NO_BYTES; }
  if (mount.path !== cookMountPath(mount.url)) { throw new Error(`Mount path differs from its URL: ${mount.url}`); }
  const bytes = checkDiscoveryMount(index.formatVersion, mount.path, options.read(mount));
  return options.onPhone ? mountedImageBytes(mount.path, bytes) : NO_BYTES;
}

function checkedMountImages(index: MountInventory, read: ReadListed, cook: CookData | undefined): number {
  const mounts = cook?.mounts ?? [];
  const urls = new Set(mounts.map((mount): string => mount.url));
  const phoneFence = isPreparedCook(cook) && cook?.fence !== undefined ? new Set(cook.fence) : undefined;
  let mountedImages = NO_BYTES;
  for (const mount of mounts) {
    mountedImages += checkedMountImageBytes(index, mount, { read, onPhone: mountedImageOnPhone(mount, urls, phoneFence) });
  }
  return mountedImages;
}

/** The cook file and the mounted engine images measured alongside its own images. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
function readCook(index: OutputIndex, read: ReadListed, ports: Pick<ShardfileValidationPorts, 'hash' | 'preparation'>): { cook: ReturnType<typeof readCookData> | undefined; mountedImages: number } {
  return coded('cook-invalid', (): { cook: ReturnType<typeof readCookData> | undefined; mountedImages: number } => {
    const cook = index.cook === undefined ? undefined : readCookData(readCanonicalJson(read(index.cook)));
    if (ports.preparation !== 'migrated') { coded('preparation-invalid', (): void => { requireCookPreparation(index, cook, ports.hash); }); }
    return { cook, mountedImages: checkedMountImages(index, read, cook) };
  });
}

/** Validate a built product folder with format alone: the index and section schemas, the exact inventory (no unlisted,
 *  missing or changed file), every hash and size, byte kinds against declared kinds and costs, KTX2 device costs, pack
 *  members, registered named JSON, budgets and admission, world targets and the declared source hash. A `client/plan`
 *  kind with no declared side (SERVER-PARITY SS2, `feature-sides.ts`) is refused by name before its section schema runs, and
 *  a script run on the wrong side (SS7, `script-sides.ts`) once the sections are read. A refusal carries the `code` of the
 *  check that refused (SA41, `issue-codes.ts`). */
export function validateShardfileFolder(files: ShardfileFiles, ports: ShardfileValidationPorts): ValidatedShardfile {
  const verify = ports.verify ?? ((bytes: Uint8Array, expected: string): boolean => ports.hash(bytes) === expected);
  const index = coded('index-invalid', (): OutputIndex => parseIncomingIndex(readCanonicalJson(files.read('shard.json', limits.sourceBytes))));
  const listed = new Set(['shard.json', 'validation.json']), { assets, keep } = assetStore(files.read, ports.readThrough === true);
  const read: ReadListed = (entry): Uint8Array => coded('file-mismatch', (): Uint8Array => {
    listed.add(entry.path);
    const bytes = files.read(entry.path, entry.bytes);
    if (bytes.length !== entry.bytes || !verify(bytes, entry.hash, true)) throw new Error(`Output hash or size mismatch: ${entry.path}`);
    return bytes;
  });
  const payloads = readSections(index, read), warnings = coded('script-side', (): string[] => assertScriptSides(payloads, index, { ...files, verify }));
  const scripts = coded('script-admission', (): ScriptAdmissionRows => scriptAdmissionRows(payloads));
  const contracts = coded('script-admission', (): ReturnType<typeof decisionModuleContracts> => decisionModuleContracts(scripts, index.files));
  for (const entry of index.files) {
    const bytes = read({ path: entry.path, hash: entry.hash, bytes: entry.compressed });
    coded('blob-invalid', (): void => { inspectBlob(entry, bytes, ports, entry.kind === 'wasm' ? contracts.get(entry.hash) ?? { abi: 0 } : undefined); });
    keep(entry, bytes, index.requires.commons.includes(entry.hash));
  }
  checkServerAndKtx2(index, read, assets);
  coded('pack-invalid', (): void => { checkPacks(index, new Set(files.paths()), { readFile: files.read, readListed: read, verify, hash: ports.hash }); });
  const { cook, mountedImages } = readCook(index, read, ports);
  if (ports.judged !== 'stored' && index.shardVersion !== undefined) {
    const mounts = cook?.mounts ?? [];
    const discovery = mounts.filter((mount): boolean => isDiscoveryMount(mount.path)).map((mount): unknown => readDiscoveryArt(read(mount)));
    assertStandaloneArt([...payloads.values(), ...discovery], mounts);
    assertShardMountUrls(index.identity.slug, mounts);
  }
  for (const entry of index.runtime?.files ?? []) {
    if (ports.runtimeImports === undefined) throw issueError('runtime-files', 'Copied runtime files need a runtime import checker');
    coded('runtime-files', (): void => { ports.runtimeImports?.(entry.path, decoder().decode(read(entry))); });
  }
  for (const path of files.paths()) if (!listed.has(path)) throw issueError('unlisted-file', `Unlisted output file: ${path}`);
  coded('carried-ktx2', (): void => { refuseCarriedKtx2(index, files.paths(), ports.judged); });
  const shard = admitShardfileFolder(coded('shard-schema', (): unknown => assembleOutputShardfile(index, payloads)), assets, ports.hash, 'warn', scripts, { sections: payloads, mountedImages, index, judged: ports.judged ?? 'upload', armed: ports.armed });
  checkWorldTargets(shard, payloads.get('world/targets'));
  if (!declaredSourceMatches(shard, index, ports.hash)) throw issueError('source-hash', 'Output sections differ from the declared source hash');
  return { index, shard, assets, sections: payloads, scripts, ...deprecationReport({ index, sections: payloads, cook }, [...warnings, ...phoneCopyWarnings(cook?.mounts ?? [])]), policy: admittedVerdict(shard), audio: shardfileRecordings({ cook, read: files.read, shard, assets }) };
}
