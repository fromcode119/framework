import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrameworkReleaseSource } from '@core/management/framework-release-source';
import { ReleaseFetchCache } from '@core/management/release-fetch-cache';

/**
 * How soon a new release is seen. The tag list and an image's "not yet" used to be remembered for 15
 * and 5 minutes, so a release reached installations about 20 minutes after its images, and "Check for
 * updates" answered from that same memory.
 */
describe('FrameworkReleaseSource freshness', () => {
  let now = 0;
  let tags: Array<{ name: string; commit: { sha: string } }> = [];
  let published: string[] = [];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    now = 1_000_000;
    tags = [{ name: 'v0.2.575', commit: { sha: 'a' } }];
    published = ['v0.2.575'];
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.spyOn(FrameworkReleaseSource, 'repository').mockResolvedValue('Owner/repo');
    fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (url.includes('/tags?')) return { ok: true, json: async () => tags };
      if (url.startsWith('https://ghcr.io/token')) return { ok: true, json: async () => ({ token: 't' }) };
      if (url.startsWith('https://ghcr.io/v2/')) return { ok: init?.method === 'HEAD' && published.includes(url.split('/manifests/')[1]) };
      return { ok: false, text: async () => '', json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); ReleaseFetchCache.clear(); });

  const tagReads = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/tags?')).length;
  const release = (version: string, imagesReady: boolean) => {
    tags = [{ name: `v${version}`, commit: { sha: version } }, ...tags];
    if (imagesReady) published.push(`v${version}`);
  };

  it('sees a new tag once the tag list is older than TAGS_MS, and not before', async () => {
    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.575');
    release('0.2.576', true);

    now += FrameworkReleaseSource.TAGS_MS - 1;
    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.575');

    now += 2;
    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.576');
    expect(FrameworkReleaseSource.TAGS_MS).toBeLessThanOrEqual(2 * 60 * 1000);
  });

  it('asks the tag list at most 30 times an hour, half of GitHub\'s unauthenticated allowance', async () => {
    for (let minute = 0; minute < 60; minute += 1) {
      await FrameworkReleaseSource.latestVersion();
      now += 60 * 1000;
    }
    expect(tagReads()).toBeLessThanOrEqual(30);
  });

  it('offers a tag a minute after its images appear, not five', async () => {
    release('0.2.576', false);
    now += FrameworkReleaseSource.TAGS_MS;
    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.575');

    published.push('v0.2.576');
    now += FrameworkReleaseSource.UNPUBLISHED_MS;
    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.576');
  });

  it('a refresh by hand finds a release published seconds ago', async () => {
    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.575');
    release('0.2.576', true);
    now += ReleaseFetchCache.REFRESH_MIN_AGE_MS;

    FrameworkReleaseSource.refresh();

    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.576');
  });

  it('a refresh pressed again within half a minute asks nobody, and keeps what is published', async () => {
    await FrameworkReleaseSource.latestVersion();
    const probes = fetchMock.mock.calls.length;
    now += ReleaseFetchCache.REFRESH_MIN_AGE_MS - 1;

    FrameworkReleaseSource.refresh();
    await FrameworkReleaseSource.latestVersion();

    expect(fetchMock.mock.calls.length).toBe(probes);
    now += 1;
    FrameworkReleaseSource.refresh();
    await FrameworkReleaseSource.latestVersion();
    // The tag list is asked again; the published image of 0.2.575 is not probed again.
    expect(tagReads()).toBe(2);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('https://ghcr.io/v2/')).length).toBe(1);
  });
});
