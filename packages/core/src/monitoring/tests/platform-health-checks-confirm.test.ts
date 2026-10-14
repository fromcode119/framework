import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformHealthChecks } from '@core/monitoring/platform-health-checks';
import { HostResourceService } from '@core/management/host-resource-service';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { EnvUtils } from '@core/utils/env-utils';

/**
 * One stalled connection is not an outage. On 2026-10-13 a seven-hour IPv6 fault made every name lookup
 * take eight seconds, so a probe's ten-second limit was beaten now and then; each miss opened an incident
 * that resolved itself five minutes later. A site is down when it fails twice in a row.
 */
describe('PlatformHealthChecks — a site is down only after it fails twice', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const sites = [{ id: 'shop', slug: 'shop', primaryHost: 'shop.example', isWorkspace: false, isReadable: true }];
  const run = () => {
    vi.spyOn(HostResourceService, 'read').mockResolvedValue({} as any);
    vi.spyOn(PlatformSettingsService, 'getSetting').mockResolvedValue(null);
    vi.spyOn(EnvUtils, 'isProduction').mockReturnValue(true);
    return new PlatformHealthChecks({ plugins: new Map() }, async () => sites as any, 0).run();
  };
  const timeout = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });

  it('reports nothing when the second attempt answers', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(timeout()).mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    expect(await run()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks once, not twice, of a site that answers the first time', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    expect(await run()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a site that fails both attempts, saying why and how many times it was asked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout()));

    const found = await run();

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ key: 'site-down:shop', kind: 'site-down', subject: 'shop' });
    expect(found[0].values).toMatchObject({ url: 'https://shop.example/', error: 'UND_ERR_CONNECT_TIMEOUT', attempts: PlatformHealthChecks.PROBE_ATTEMPTS });
  });

  it('treats a server error that clears on the second attempt as answered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ status: 503 }).mockResolvedValueOnce({ status: 200 }));

    expect(await run()).toEqual([]);
  });
});
