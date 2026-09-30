import { describe, it, expect } from 'vitest';
import { MediaRelationFieldUtils } from '@/components/collection/media-relation-field-utils';

/**
 * A media field that allows several files used to REPLACE its value with the one just picked, so it could
 * never hold more than one; and a PDF previewed as a broken image. Picking adds, removing drops one, and
 * a file's type decides whether it previews as a picture.
 */
describe('media field selection', () => {
  it('adds a picked file to a many-file field, once', () => {
    expect(MediaRelationFieldUtils.withSelected([5], 6, true)).toEqual([5, 6]);
    expect(MediaRelationFieldUtils.withSelected([5, 6], '6', true)).toEqual([5, 6]);
  });

  it('replaces the file of a one-file field', () => {
    expect(MediaRelationFieldUtils.withSelected([5], 6, false)).toBe(6);
  });

  it('removes one file from a many-file field, and clears a one-file field', () => {
    expect(MediaRelationFieldUtils.withoutSelected([5, 6, 7], '6', true)).toEqual([5, 7]);
    expect(MediaRelationFieldUtils.withoutSelected([5], 5, false)).toBeNull();
  });

  it('previews only images as pictures', () => {
    expect(MediaRelationFieldUtils.mimeTypeOf({ mimeType: 'application/pdf', filename: 'manual.pdf' })).toBe('application/pdf');
    expect(MediaRelationFieldUtils.mimeTypeOf({ filename: 'logo.PNG' }).startsWith('image/')).toBe(true);
    expect(MediaRelationFieldUtils.mimeTypeOf({ url: '/uploads/manual.pdf' }).startsWith('image/')).toBe(false);
  });
});
