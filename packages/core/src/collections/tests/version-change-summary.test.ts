import { describe, expect, it } from 'vitest';
import { VersionChangeSummary } from '@core/collections/version-change-summary';

/** A summary the framework writes is a code the console translates; one a person typed is left alone. */
describe('VersionChangeSummary', () => {
  it('reads back the codes the framework writes', () => {
    expect(VersionChangeSummary.parse(VersionChangeSummary.UPDATED)).toEqual({ kind: 'updated' });
    expect(VersionChangeSummary.parse(VersionChangeSummary.restored(4))).toEqual({ kind: 'restored', version: '4' });
  });

  it('is no code for a summary a person typed', () => {
    expect(VersionChangeSummary.parse('Fixed the price typo')).toBeNull();
    expect(VersionChangeSummary.parse('')).toBeNull();
    expect(VersionChangeSummary.parse(null)).toBeNull();
  });
});
