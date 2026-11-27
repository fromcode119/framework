import type { IStorageByteRange } from '@fromcode119/media';

/**
 * The one part of a file an HTTP `Range` header asks for (`bytes=0-`, `bytes=100-199`, `bytes=-500`), as both
 * ends included. Several parts at once, or a header this does not read, is answered as the whole file — which
 * HTTP allows. A part that starts past the end cannot be given at all.
 */
export class MediaByteRange {
  static readonly UNSATISFIABLE = Symbol('unsatisfiable');
  private static readonly ONE = /^bytes=(\d*)-(\d*)$/;

  /** null: the whole file. */
  static parse(header: unknown, size: number): IStorageByteRange | null | typeof MediaByteRange.UNSATISFIABLE {
    const match = MediaByteRange.ONE.exec(String(header ?? '').trim());
    if (!match || !(size > 0)) return null;
    const [, from, to] = match;
    if (!from && !to) return null;
    if (!from) {
      const last = Math.min(size, Number(to));
      return last > 0 ? { start: size - last, end: size - 1 } : MediaByteRange.UNSATISFIABLE;
    }
    const start = Number(from);
    if (start >= size) return MediaByteRange.UNSATISFIABLE;
    const end = to ? Math.min(size - 1, Number(to)) : size - 1;
    return end >= start ? { start, end } : MediaByteRange.UNSATISFIABLE;
  }
}
