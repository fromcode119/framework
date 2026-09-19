import { describe, expect, it } from 'vitest';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';

/**
 * A colliding upload is stored under a new name, and the `media` row that owns it is rewritten to
 * match. The same file name is ALSO written into content — a page's blocks hold `/uploads/<name>`
 * verbatim — and the uploads directory is shared by every site on the platform, so a reference left
 * pointing at the original name resolves to whichever site uploaded it first.
 */
class RenamedFiles {
  /** The rename map is private and filled by `run()`; these tests drive it the way an import does. */
  static with(pairs: Array<[string, string]>): TenantImportFiles {
    const files = new TenantImportFiles('/tmp/does-not-matter');
    const renamed = (files as unknown as { renamed: Map<string, string> }).renamed;
    for (const [from, to] of pairs) renamed.set(from, to);
    return files;
  }
}

describe('TenantImportFiles.rewriteUploadReferences', () => {
  it('rewrites a reference inside content, not just the media row', () => {
    const files = RenamedFiles.with([['photo.jpg', 'photo-alpha.jpg']]);
    const values: Record<string, unknown> = {
      content: { blocks: [{ type: 'image-block', imageUrl: '/uploads/photo.jpg' }] },
    };
    files.rewriteUploadReferences(values);
    expect(JSON.stringify(values)).toContain('/uploads/photo-alpha.jpg');
    expect(JSON.stringify(values)).not.toContain('/uploads/photo.jpg"');
  });

  it('rewrites a bare file name and a full URL alike', () => {
    const files = RenamedFiles.with([['photo.jpg', 'photo-alpha.jpg']]);
    const values: Record<string, unknown> = {
      optimized_path: 'photo.jpg',
      src: 'https://example.test/uploads/photo.jpg',
    };
    files.rewriteUploadReferences(values);
    expect(values.optimized_path).toBe('photo-alpha.jpg');
    expect(values.src).toBe('https://example.test/uploads/photo-alpha.jpg');
  });

  it('leaves a file this import did not rename exactly as written', () => {
    const files = RenamedFiles.with([['photo.jpg', 'photo-alpha.jpg']]);
    const values: Record<string, unknown> = { content: '/uploads/untouched.jpg' };
    files.rewriteUploadReferences(values);
    expect(values.content).toBe('/uploads/untouched.jpg');
  });

  it('does not rewrite a longer name that merely starts with a renamed one', () => {
    const files = RenamedFiles.with([['photo.jpg', 'photo-alpha.jpg']]);
    const values: Record<string, unknown> = { content: '/uploads/photo.jpg.bak' };
    files.rewriteUploadReferences(values);
    expect(values.content).toBe('/uploads/photo.jpg.bak');
  });

  it('does not rewrite a name that is the tail of a different file name', () => {
    const files = RenamedFiles.with([['photo.jpg', 'photo-alpha.jpg']]);
    const values: Record<string, unknown> = { content: '/uploads/my-photo.jpg' };
    files.rewriteUploadReferences(values);
    expect(values.content).toBe('/uploads/my-photo.jpg');
  });

  it('is a no-op when nothing was renamed', () => {
    const files = RenamedFiles.with([]);
    const values: Record<string, unknown> = { content: '/uploads/photo.jpg' };
    files.rewriteUploadReferences(values);
    expect(values.content).toBe('/uploads/photo.jpg');
  });
});
