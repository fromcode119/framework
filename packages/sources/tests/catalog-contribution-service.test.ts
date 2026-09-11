import { describe, it, expect } from 'vitest';
import { CatalogContributionService } from '@sources/catalog/catalog-contribution-service';

describe('CatalogContributionService.entriesFrom', () => {
  const source = (over: Record<string, unknown> = {}): any => ({
    slug: 'forms',
    type: 'plugin',
    version: '1.2.0',
    fileName: 'forms-1.2.0.tar.gz',
    lastBuildStatus: 'success',
    changelog: 'Add conditional fields',
    ...over,
  });

  it('offers a successfully built version to the catalogue', () => {
    const [entry] = CatalogContributionService.entriesFrom([source()]);
    expect(entry).toMatchObject({ slug: 'forms', version: '1.2.0', kind: 'plugin' });
    expect(entry.notes).toBe('Add conditional fields');
  });

  /**
   * A failed build has no artifact. Offering its version would advertise an update that cannot be
   * installed — the worst kind, because the operator only finds out after accepting it.
   */
  it('offers nothing for a build that failed', () => {
    expect(CatalogContributionService.entriesFrom([source({ lastBuildStatus: 'failed' })])).toEqual([]);
  });

  it('offers nothing for a source that has never been built', () => {
    expect(CatalogContributionService.entriesFrom([source({ lastBuildStatus: 'pending', version: '' })])).toEqual([]);
  });

  /** A build that produced no version cannot be compared against what is installed. */
  it('offers nothing when the build recorded no version', () => {
    expect(CatalogContributionService.entriesFrom([source({ version: '' })])).toEqual([]);
  });

  /** No changelog is honest — a first build has no previous revision to compare against. */
  it('carries an empty changelog rather than inventing one', () => {
    const [entry] = CatalogContributionService.entriesFrom([source({ changelog: undefined })]);
    expect(entry.notes).toBe('');
  });
});
