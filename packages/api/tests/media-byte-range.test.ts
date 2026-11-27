import { describe, expect, it } from 'vitest';
import { MediaByteRange } from '@api/controllers/media-byte-range';

/** A video player reads a file in parts; each part must be exactly what it asked for, or the video stalls. */
describe('MediaByteRange', () => {
  it('reads one part, both ends included, clamped to the file', () => {
    expect(MediaByteRange.parse('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(MediaByteRange.parse('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(MediaByteRange.parse('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(MediaByteRange.parse('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('gives the whole file for no header, several parts, or a file of unknown size', () => {
    expect(MediaByteRange.parse(undefined, 1000)).toBeNull();
    expect(MediaByteRange.parse('bytes=0-1,5-9', 1000)).toBeNull();
    expect(MediaByteRange.parse('bytes=0-99', 0)).toBeNull();
  });

  it('cannot give a part that starts past the end', () => {
    expect(MediaByteRange.parse('bytes=1000-', 1000)).toBe(MediaByteRange.UNSATISFIABLE);
    expect(MediaByteRange.parse('bytes=50-10', 1000)).toBe(MediaByteRange.UNSATISFIABLE);
  });
});
