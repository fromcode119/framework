import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformHealthChecks } from '@core/monitoring/platform-health-checks';
import { HostResourceService } from '@core/management/host-resource-service';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { EnvUtils } from '@core/utils/env-utils';

/** Every check used to fetch every site's home page at the same moment — a burst of renders on a small box. */
describe('PlatformHealthChecks site probes', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('fetches at most a couple of sites at once, and still reports every one that is down', async () => {
    let inFlight = 0;
    let peak = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { status: url.includes('down') ? 503 : 200 };
    }));
    vi.spyOn(HostResourceService, 'read').mockResolvedValue({} as any);
    vi.spyOn(PlatformSettingsService, 'getSetting').mockResolvedValue(null);
    vi.spyOn(EnvUtils, 'isProduction').mockReturnValue(true);
    const sites = ['a', 'down1', 'b', 'c', 'down2', 'd'].map((slug) => ({ id: slug, slug, primaryHost: `${slug}.example`, isWorkspace: false, isReadable: true }));

    const found = await new PlatformHealthChecks({ plugins: new Map() }, async () => sites as any).run();

    expect(peak).toBe(PlatformHealthChecks.PROBES_AT_ONCE);
    expect(found.map((incident) => incident.key).sort()).toEqual(['site-down:down1', 'site-down:down2']);
  });
});
