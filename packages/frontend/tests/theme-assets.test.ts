import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The component file exports only the class; render its static.
import { ThemeAssetsView } from '@/components/theme-assets';
import { ServerApiUtils } from '@/lib/server-api';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

const preloadSpy = vi.hoisted(() => vi.fn());

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    preload: preloadSpy,
  };
});

describe('ThemeAssets', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    preloadSpy.mockReset();
  });

  it('uses the absolute theme entry origin for relative headLinks when api env is unavailable', async () => {
    vi.spyOn(ServerApiUtils, 'serverFetchInternalResponseOutcome').mockResolvedValue(ServerFetchOutcome.resolved<Response>(null));
    vi.spyOn(ServerApiUtils, 'serverFetchJsonOutcome').mockResolvedValue(ServerFetchOutcome.resolved({
      activeTheme: {
        slug: 'vselenskiportal88',
        ui: {
          entry: 'http://api.framework.local/api/v1/themes/vselenskiportal88/ui/bundle.js?v=1.0.10',
          headLinks: [
            {
              rel: 'preload',
              href: '/api/v1/themes/vselenskiportal88/ui/logo.webp',
              as: 'image',
              type: 'image/webp',
            },
          ],
        },
      },
    }));
    vi.spyOn(ServerApiUtils, 'buildPublicApiBaseUrl').mockReturnValue('');

    renderToStaticMarkup(await ThemeAssetsView.render());

    expect(preloadSpy).toHaveBeenCalledWith(
      'http://api.framework.local/api/v1/themes/vselenskiportal88/ui/logo.webp',
      expect.objectContaining({
        as: 'image',
        type: 'image/webp',
      }),
    );
  });
});
