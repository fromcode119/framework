import { SiteBaseUrl } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { MediaController } from '@api/controllers/media-controller';
import { ApiUrlUtils } from '@api/utils/url';

/**
 * A site's uploads are written into its own directory, and `/uploads` is served per HOST — so a URL
 * on the platform's api host (which names no site) could only reach the shared root, and every file
 * uploaded since sites got their own directories came back with a URL that 404'd. The admin's media
 * library drew a generic file icon for each of them.
 */
describe('media URLs are built on the current site', () => {
  afterEach(() => vi.restoreAllMocks());

  const fakeDriver = () => ({
    provider: 'local',
    getUrl: (p: string) => `/uploads/${p}`,
    save: vi.fn(), read: vi.fn(), stream: vi.fn(), delete: vi.fn(),
  }) as any;
  const manager = new MediaManager({ [MediaManager.PUBLIC_SPACE]: fakeDriver() });
  const db = (rows: any[]) => ({
    find: vi.fn().mockResolvedValue(rows),
    desc: vi.fn().mockReturnValue('desc'), asc: vi.fn().mockReturnValue('asc'),
  }) as any;
  const row = { id: 1, filename: 'hero.webp', originalName: 'hero.webp', mimeType: 'image/webp',
    fileSize: 1, path: 'hero.webp', folderId: null, visibility: 'public', createdAt: '', updatedAt: '' };
  const res = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() }) as any;

  it('lists a site file on the site host, not the platform api host', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('http://core-demo.framework.local');
    const response = res();

    await new MediaController({ db: db([row]) } as any, manager).listFiles({ query: {} } as any, response);

    expect(response.json.mock.calls[0][0][0].url).toBe('http://core-demo.framework.local/uploads/hero.webp');
  });

  it('falls back to the api origin when no site is bound', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('');
    vi.spyOn(ApiUrlUtils, 'resolveApiPublicOrigin').mockReturnValue('http://api.framework.local');

    expect(await ApiUrlUtils.resolveSitePublicOrigin({} as any)).toBe('http://api.framework.local');
  });

  it('joins without doubling slashes and leaves absolute URLs alone', () => {
    expect(ApiUrlUtils.joinPublicUrl('http://a.test/', '/uploads/x.png')).toBe('http://a.test/uploads/x.png');
    expect(ApiUrlUtils.joinPublicUrl('http://a.test', 'uploads/x.png')).toBe('http://a.test/uploads/x.png');
    expect(ApiUrlUtils.joinPublicUrl('http://a.test', 'https://cdn.test/x.png')).toBe('https://cdn.test/x.png');
    expect(ApiUrlUtils.joinPublicUrl('', '/uploads/x.png')).toBe('/uploads/x.png');
  });
});

/**
 * `STORAGE_PUBLIC_URL` is normally the platform api's `/uploads`, so the driver returns a URL that
 * is already absolute on a host naming no site. It has to be rebased onto the site, or the fix above
 * never engages — this is the configuration the local stack and production actually run.
 */
describe('an absolute storage URL on the platform api host', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is rebased onto the site origin', async () => {
    const { ApplicationUrlUtils } = await import('@fromcode119/core');
    vi.spyOn(ApplicationUrlUtils, 'readAppBaseUrlFromEnvironment').mockReturnValue('http://api.framework.local');
    expect(ApiUrlUtils.sitePublicUrl('http://core-demo.framework.local', 'http://api.framework.local/uploads/hero.webp'))
      .toBe('http://core-demo.framework.local/uploads/hero.webp');
  });

  it('is left alone when no site is bound, and a CDN URL is never touched', async () => {
    const { ApplicationUrlUtils } = await import('@fromcode119/core');
    vi.spyOn(ApplicationUrlUtils, 'readAppBaseUrlFromEnvironment').mockReturnValue('http://api.framework.local');
    expect(ApiUrlUtils.sitePublicUrl('http://api.framework.local', 'http://api.framework.local/uploads/x.png'))
      .toBe('http://api.framework.local/uploads/x.png');
    expect(ApiUrlUtils.sitePublicUrl('http://core-demo.framework.local', 'https://cdn.example.com/x.png'))
      .toBe('https://cdn.example.com/x.png');
  });
});
