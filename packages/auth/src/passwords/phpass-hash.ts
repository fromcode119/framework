import { createHash } from 'crypto';

/**
 * The portable phpass hash — WordPress and phpBB (`$P$`/`$H$`, MD5) and Drupal 7+ (`$S$`, SHA-512,
 * truncated to 55 characters). Implemented from the published algorithm so imported accounts can sign
 * in once and be rehashed; nothing here ever CREATES a phpass hash.
 *
 * The iteration count is read from the hash itself, so it is capped: a hash claiming 2^30 rounds
 * would otherwise hold a login request for minutes. WordPress writes 2^8, Drupal 2^15 to 2^16.
 */
export class PhpassHash {
  private static readonly ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  private static readonly MIN_LOG2 = 7;
  private static readonly MAX_LOG2 = 18;
  private static readonly DRUPAL_LENGTH = 55;

  /** The hash `password` would have under `stored`'s settings, or null when `stored` is not a valid one. */
  static compute(password: string, stored: string): string | null {
    const marker = stored.slice(0, 3);
    const algorithm = marker === '$S$' ? 'sha512' : (marker === '$P$' || marker === '$H$') ? 'md5' : null;
    if (!algorithm || stored.length < 12) return null;

    const log2 = PhpassHash.ITOA64.indexOf(stored[3]);
    if (log2 < PhpassHash.MIN_LOG2 || log2 > PhpassHash.MAX_LOG2) return null;
    const salt = stored.slice(4, 12);
    if (salt.length !== 8) return null;

    const secret = Buffer.from(password, 'utf8');
    let digest = createHash(algorithm).update(Buffer.concat([Buffer.from(salt, 'binary'), secret])).digest();
    for (let round = 1 << log2; round > 0; round -= 1) {
      digest = createHash(algorithm).update(Buffer.concat([digest, secret])).digest();
    }

    const full = stored.slice(0, 12) + PhpassHash.encode64(digest);
    return algorithm === 'md5' ? full : full.slice(0, PhpassHash.DRUPAL_LENGTH);
  }

  private static encode64(input: Buffer): string {
    const itoa = PhpassHash.ITOA64;
    let output = '';
    let index = 0;
    while (index < input.length) {
      let value = input[index++];
      output += itoa[value & 0x3f];
      if (index < input.length) value |= input[index] << 8;
      output += itoa[(value >> 6) & 0x3f];
      if (index++ >= input.length) break;
      if (index < input.length) value |= input[index] << 16;
      output += itoa[(value >> 12) & 0x3f];
      if (index++ >= input.length) break;
      output += itoa[(value >> 18) & 0x3f];
    }
    return output;
  }
}
