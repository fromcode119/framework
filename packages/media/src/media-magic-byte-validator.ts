/**
 * Magic-byte (file signature) validation for uploaded raster images.
 *
 * The upload pipeline derives the MIME type from the file extension alone,
 * which lets an attacker upload arbitrary content with an innocent-looking
 * image extension. For the allowed raster types (jpg/jpeg, png, gif, webp)
 * the file content must start with the format's signature or the upload is
 * rejected. Text formats (e.g. SVG) are handled by sanitization instead —
 * they have no reliable signature.
 */
export class MediaMagicByteValidator {
  /** Extensions (lowercase, with dot) this validator can verify. */
  public static readonly VALIDATED_EXTENSIONS: ReadonlySet<string> = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    // Documents people attach to forms: a CV renamed from an executable must not be stored as one.
    '.pdf', '.docx', '.xlsx', '.pptx', '.odt', '.ods', '.doc', '.xls', '.ppt',
  ]);

  public static canValidate(ext: string): boolean {
    return this.VALIDATED_EXTENSIONS.has(String(ext || '').toLowerCase());
  }

  /**
   * Returns true when the buffer's leading bytes match the signature implied
   * by the extension. Unknown extensions return true (nothing to verify here).
   */
  public static matchesExtension(ext: string, buffer: Buffer): boolean {
    const normalizedExt = String(ext || '').toLowerCase();
    if (!this.canValidate(normalizedExt)) return true;
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

    switch (normalizedExt) {
      case '.jpg':
      case '.jpeg':
        // FF D8 FF
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      case '.png':
        // 89 50 4E 47 0D 0A 1A 0A
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case '.gif':
        // "GIF87a" or "GIF89a"
        return buffer.subarray(0, 6).toString('latin1') === 'GIF87a'
          || buffer.subarray(0, 6).toString('latin1') === 'GIF89a';
      case '.webp':
        // "RIFF" <4-byte size> "WEBP"
        return buffer.subarray(0, 4).toString('latin1') === 'RIFF'
          && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
      case '.pdf':
        // "%PDF-"
        return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
      case '.docx':
      case '.xlsx':
      case '.pptx':
      case '.odt':
      case '.ods':
        // Office Open XML and OpenDocument are ZIP containers: "PK" 03 04
        return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      case '.doc':
      case '.xls':
      case '.ppt':
        // Legacy Office: OLE compound file D0 CF 11 E0 A1 B1 1A E1
        return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
      default:
        return true;
    }
  }
}
