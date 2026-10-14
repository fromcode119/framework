import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameworkReleaseSource } from '@core/management/framework-release-source';

/** What the update screen lists between the installed version and the newest, and where the notes come from. */
describe('FrameworkReleaseSource.pending notes', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const CHANGELOG = '# Changelog\n\n## [0.2.391] - 2026-10-14\n\n### Fixed\n\n- **admin**: the switch shows the platform state ([#929](https://x/929))\n\n## [0.2.390] - 2026-10-14\n\n### Fixed\n\n- **monitoring**: confirm a site is down before alerting ([#927](https://x/927))\n';
  const tags = [{ name: 'v0.2.391', commit: { sha: 'a' } }, { name: 'v0.2.390', commit: { sha: 'b' } }, { name: 'v0.2.389', commit: { sha: 'c' } }];

  const stub = (changelog: string, commitMessages: Record<string, string> = {}) => {
    vi.spyOn(FrameworkReleaseSource, 'repository').mockResolvedValue('owner/repo');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/CHANGELOG.md')) return changelog ? { ok: true, text: async () => changelog } : { ok: false, text: async () => '' };
      if (url.includes('/tags?')) return { ok: true, json: async () => tags };
      const sha = url.split('/commits/')[1];
      return { ok: true, json: async () => ({ commit: { message: commitMessages[sha] ?? 'chore(release): x' } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('takes each pending version\'s notes from the changelog, with one request for the file', async () => {
    const fetchMock = stub(CHANGELOG);

    const pending = await FrameworkReleaseSource.pending('0.2.389');

    expect(pending.map((release) => release.version)).toEqual(['0.2.391', '0.2.390']);
    expect(pending[0].notes).toContain('admin: the switch shows the platform state (#929)');
    expect(pending[1].notes).toContain('monitoring: confirm a site is down before alerting (#927)');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/CHANGELOG.md'))).toHaveLength(1);
    expect(String(fetchMock.mock.calls.find(([url]) => String(url).endsWith('/CHANGELOG.md'))![0])).toBe('https://raw.githubusercontent.com/owner/repo/v0.2.391/CHANGELOG.md');
  });

  it('falls back to the release commit\'s message when the changelog has no section for a version', async () => {
    stub(CHANGELOG.split('## [0.2.390]')[0], { b: 'chore(release): 0.2.390\n\nHand-written note for 0.2.390.' });

    const pending = await FrameworkReleaseSource.pending('0.2.389');

    expect(pending[0].notes).toContain('admin: the switch shows the platform state');
    expect(pending[1].notes).toBe('Hand-written note for 0.2.390.');
  });

  it('shows nothing, not a stand-in, when neither place says anything', async () => {
    stub('');

    const pending = await FrameworkReleaseSource.pending('0.2.389');

    expect(pending.map((release) => release.notes)).toEqual(['', '']);
  });

  it('asks for nothing when the installation is already on the newest version', async () => {
    const fetchMock = stub(CHANGELOG);

    expect(await FrameworkReleaseSource.pending('0.2.391')).toEqual([]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/CHANGELOG.md'))).toBe(false);
  });
});
