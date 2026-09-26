import { describe, expect, it } from 'vitest';
import { PermalinkInputUtils } from '@/components/ui/permalink-input-utils';

/** The address the Preview & Permalink box shows must be where the page lives: the site's storefront. */
describe('PermalinkInputUtils.compute — base URL', () => {
  it('shows the bound site’s storefront, not the platform address a site scope inherits', () => {
    const computed = PermalinkInputUtils.compute(
      { value: '', slug: 'annual', onChange: () => {} } as never,
      { frontend_url: 'https://platform.example', site_url: 'https://platform.example' },
      'https://shop.example.com',
    );
    expect(computed.baseUrl).toBe('https://shop.example.com');
  });
});
