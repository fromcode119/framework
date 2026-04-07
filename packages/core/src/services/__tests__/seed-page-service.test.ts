import { describe, expect, it } from 'vitest';
import { SeedPageService } from '../seed-page-service';

describe('SeedPageService', () => {
  it('normalizes root-path lookup candidates without generating malformed slash variants', () => {
    const service = new SeedPageService();

    expect(
      service.buildPageLookupCandidates([' / ', '/'], {
        customPermalink: '/',
        slug: '/',
      }),
    ).toEqual(['/']);
  });

  it('keeps root candidates distinct from normalized non-root variants', () => {
    const service = new SeedPageService();

    expect(
      service.buildPageLookupCandidates(['/'], {
        customPermalink: '/',
        slug: 'home',
      }),
    ).toEqual(['/', 'home', '/home', 'home/', '/home/']);
  });
});