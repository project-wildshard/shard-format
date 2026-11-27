/** SF16/SF17 (J525): a texture named by hash is a KTX2 or a PNG or JPEG image the cook encodes. */
export const isTextureKind = (kind: string | undefined): boolean =>
  kind === 'ktx2' || kind === 'image'
