import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';
import { ServerApiUtils } from '@/lib/server-api/server-api';
import { HomePageResolver } from '@/app/home-page-resolver';

/**
 * A `/bg` page asks for its menus and its home document in Bulgarian. Both once asked without the
 * language, so the address named one language and the page carried another.
 */
describe('server-side reads follow the document language', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('names the language on a theme prefetch', async () => {
    vi.spyOn(ServerApiUtils, 'buildForwardedAuthHeaders').mockResolvedValue({} as never);
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => { asked.push(url); return new Response('{}'); });
    await ThemeDataPrefetcher.prefetch({ ui: { prefetchApis: [{ key: 'menu', pluginSlug: 'cms', path: '/navigation/header-links' }] } }, 'bg');
    expect(asked[0]).toMatch(/navigation\/header-links\?locale=bg$/);
  });

  it('resolves the home document in the language its path names', async () => {
    const resolve = vi.spyOn(HomePageResolver as any, 'resolveHomeTarget').mockResolvedValue({ content: null });
    vi.spyOn(HomePageResolver as any, 'getLocaleUrlStrategy').mockResolvedValue((await import('@fromcode119/core/client')).LocaleUrlStrategy.PATH);
    await HomePageResolver.resolve({}, 'bg');
    expect(resolve).toHaveBeenCalledWith('bg', '');
  });
});
