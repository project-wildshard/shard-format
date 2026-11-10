/** A JSON envelope keeps the complete dense fixture below the original 5 MB total. */
declare function sealGraphPart(data: Readonly<Uint8Array>): Promise<Uint8Array>;
/** Stream-bounded decompression precedes parsing any graph node or expanding its tree. */
declare function openGraphPart(data: Readonly<Uint8Array>, expected?: number): Promise<Uint8Array>;
export { sealGraphPart, openGraphPart };
