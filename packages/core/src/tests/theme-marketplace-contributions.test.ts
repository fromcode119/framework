import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoreServices } from '@core/services/core-services';
import { ThemeUpdateService } from '@core/theme/theme-update-service';

/**
 * A theme built on THIS installation has to be installable from it.
 *
 * Sources clones a repository, builds the theme and offers the result to the catalogue. The plugins
 * screen has always merged those offers; this one asked the remote marketplace only — so a theme you
 * had just built appeared nowhere. Sources said "Success", Themes → Marketplace said "Marketplace
 * empty", and an installation with no marketplace configured could never install its own theme.
 */
describe('ThemeUpdateService — what the themes marketplace offers', () => {
  const logger = { debug: vi.fn(), error: vi.fn() } as never;

  const withContributions = (rows: Array<Record<string, unknown>>) => {
    vi.spyOn(CoreServices, 'getInstance').mockReturnValue({
      catalogContributions: { list: () => [{ canonicalKey: 'org.fromcode:sources', list: async () => rows }] },
    } as never);
  };

  const service = (remote: unknown) => new ThemeUpdateService(
    new Map(),
    { fetch: async () => remote } as never,
    logger,
  );

  afterEach(() => vi.restoreAllMocks());

  it('offers what this installation built, alongside the remote catalogue', async () => {
    withContributions([{ slug: 'fromcode', version: '0.1.29', kind: 'theme', downloadUrl: 'fromcode-0.1.29.zip' }]);

    const themes = await service({ themes: [{ slug: 'remote-theme', version: '1.0.0' }] }).getMarketplaceThemes();

    expect(themes.map((t: any) => t.slug)).toEqual(['remote-theme', 'fromcode']);
  });

  /** The same registry carries plugins; offering one here is an install that cannot work. */
  it('ignores contributed PLUGINS', async () => {
    withContributions([
      { slug: 'forms', version: '0.1.31', kind: 'plugin' },
      { slug: 'fromcode', version: '0.1.29', kind: 'theme' },
    ]);

    const themes = await service({ themes: [] }).getMarketplaceThemes();

    expect(themes.map((t: any) => t.slug)).toEqual(['fromcode']);
  });

  /** An unreachable marketplace must not hide what is already built and sitting on disk. */
  it('still offers local builds when the remote catalogue fails', async () => {
    withContributions([{ slug: 'fromcode', version: '0.1.29', kind: 'theme' }]);
    const failing = new ThemeUpdateService(new Map(), { fetch: async () => { throw new Error('offline'); } } as never, logger);

    const themes = await failing.getMarketplaceThemes();

    expect(themes.map((t: any) => t.slug)).toEqual(['fromcode']);
  });
});
