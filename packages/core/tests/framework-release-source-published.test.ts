import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameworkReleaseSource } from '@core/management/framework-release-source';
import { ReleaseFetchCache } from '@core/management/release-fetch-cache';

/** A tag is pushed minutes before its images; a version is offered only once its images can be pulled. */
describe('FrameworkReleaseSource published images', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); ReleaseFetchCache.clear(); });

  const tags = [{ name: 'v0.2.479', commit: { sha: 'a' } }, { name: 'v0.2.478', commit: { sha: 'b' } }, { name: 'v0.2.477', commit: { sha: 'c' } }];

  const stub = (publishedTags: string[], registryUp = true) => {
    vi.spyOn(FrameworkReleaseSource, 'repository').mockResolvedValue('Owner/repo');
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (url.includes('/tags?')) return { ok: true, json: async () => tags };
      if (url.startsWith('https://ghcr.io/token')) return registryUp ? { ok: true, json: async () => ({ token: 't' }) } : { ok: false, json: async () => ({}) };
      if (url.startsWith('https://ghcr.io/v2/')) return { ok: init?.method === 'HEAD' && publishedTags.includes(url.split('/manifests/')[1]) };
      if (url.endsWith('/CHANGELOG.md')) return { ok: false, text: async () => '' };
      return { ok: true, json: async () => ({ commit: { message: 'chore(release): x' } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('does not offer a tag whose images are not published yet', async () => {
    stub(['v0.2.478', 'v0.2.477']);

    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.478');
    expect((await FrameworkReleaseSource.pending('0.2.477')).map((release) => release.version)).toEqual(['0.2.478']);
  });

  it('probes the lower-cased api image of the configured repository', async () => {
    const fetchMock = stub(['v0.2.479']);

    await FrameworkReleaseSource.latestVersion();

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain('https://ghcr.io/v2/owner/repo-api/manifests/v0.2.479');
  });

  it('offers nothing when the registry cannot be reached', async () => {
    stub(['v0.2.479'], false);

    expect(await FrameworkReleaseSource.pending('0.2.477')).toEqual([]);
  });

  it('offers the version on the next check once its images appear', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    stub([]);
    expect(await FrameworkReleaseSource.latestVersion()).toBe('');

    stub(['v0.2.479']);
    now = ReleaseFetchCache.MISS_MS + 1;
    expect(await FrameworkReleaseSource.latestVersion()).toBe('0.2.479');
  });
});
