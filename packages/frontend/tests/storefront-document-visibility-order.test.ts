import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorefrontDocumentRenderer } from '@/lib/document/storefront-document-renderer';
import { SiteVisibilityVerdict } from '@/lib/document/site-visibility-verdict';

/**
 * The page's route starts beside the site's visibility check, not after it — but the verdict still
 * decides: a closed site answers the holding page, and nothing the route returned or threw reaches it.
 */
describe('StorefrontDocumentRenderer visibility', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const request = {} as never;
  const route = (impl: () => Promise<Response>) => vi.spyOn(StorefrontDocumentRenderer as any, 'route').mockImplementation(impl);

  it('starts the route before the verdict arrives', async () => {
    let decide!: (value: boolean) => void;
    vi.spyOn(SiteVisibilityVerdict, 'isReadable').mockReturnValue(new Promise((resolve) => { decide = resolve; }));
    const page = new Response('page');
    const spy = route(async () => page);
    const answer = StorefrontDocumentRenderer.render(request);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
    decide(true);
    expect(await answer).toBe(page);
  });

  it('answers a closed site with the holding page, ignoring the route and anything it throws', async () => {
    vi.spyOn(SiteVisibilityVerdict, 'isReadable').mockResolvedValue(false);
    const holding = new Response('holding');
    vi.spyOn(StorefrontDocumentRenderer as any, 'holding').mockReturnValue(holding);
    route(async () => { throw new Error('NEXT_REDIRECT'); });
    expect(await StorefrontDocumentRenderer.render(request)).toBe(holding);
  });

  it('passes a redirect the route throws on an open site through unchanged', async () => {
    vi.spyOn(SiteVisibilityVerdict, 'isReadable').mockResolvedValue(true);
    const redirect = new Error('NEXT_REDIRECT');
    route(async () => { throw redirect; });
    await expect(StorefrontDocumentRenderer.render(request)).rejects.toBe(redirect);
  });
});
