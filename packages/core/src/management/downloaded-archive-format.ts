/**
 * What a downloaded package IS, read from its own first bytes.
 *
 * The address and the content-type are hints a server may get wrong or leave out: a marketplace that
 * streams a package answers `application/octet-stream` at a path with no extension, and the file name
 * travels only in a header. Reading a zip as a tarball failed every marketplace theme install with
 * "TAR_BAD_ARCHIVE". The bytes cannot disagree with themselves.
 */
export class DownloadedArchiveFormat {
  /** `PK` followed by a local-file header (03 04) or, for an empty archive, the end record (05 06). */
  static isZip(bytes: Buffer): boolean {
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
    return (bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06);
  }

  /** gzip magic: what a `.tar.gz` starts with. */
  static isGzip(bytes: Buffer): boolean {
    return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  }
}
