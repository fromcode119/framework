import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteIconResolver } from '@core/theme/site-icon/site-icon-resolver';
import { SiteIcon } from '@core/theme/site-icon/site-icon';
import { SiteIconSource } from '@core/enums/site-icon-source.enum';

/**
 * A site's icon is the file picked in Settings → General → Site icon, else the active theme's own,
 * else the platform's mark — and whichever it is, the payload says so, so the admin can name it.
 */
describe('the site icon', () => {
  let uiDirectory: string;
  beforeEach(() => { uiDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'site-icon-')); });
  afterEach(() => { fs.rmSync(uiDirectory, { recursive: true, force: true }); vi.restoreAllMocks(); });

  const db = (rows: Record<string, any>) => ({
    findOne: vi.fn(async (table: string, where: Record<string, any>) => rows[`${table}:${where.id ?? where.key}`] ?? null),
  });
  const themeWith = (...files: string[]) => {
    for (const file of files) fs.writeFileSync(path.join(uiDirectory, file), 'x');
    return { slug: 'aurora', uiDirectory };
  };

  it('is the picked upload, for both icons, while the theme fallback is still reported', async () => {
    const icon = await SiteIconResolver.resolve(
      db({ '_system_meta:site_icon': { value: '7' }, 'media:7': { id: 7, path: 'icon-7.png', visibility: 'public' } }),
      themeWith('favicon.ico'),
    );
    expect(icon.favicon.source).toBe(SiteIconSource.SETTING);
    expect(icon.favicon.path).toBe('/uploads/icon-7.png');
    expect(icon.appleTouchIcon.path).toBe('/uploads/icon-7.png');
    expect(icon.themeFavicon.source).toBe(SiteIconSource.THEME);
    expect(icon.themeFavicon.file).toBe('favicon.ico');
  });

  it("is a file picked from the theme's own assets", async () => {
    const icon = await SiteIconResolver.resolve(db({ '_system_meta:site_icon': { value: 'theme:images/mark.png' } }), themeWith());
    expect(icon.favicon.path).toBe('/api/themes/aurora/ui/images/mark.png');
  });

  it("is the theme's first icon file when nothing is picked — and the apple icon from its own list", async () => {
    const icon = await SiteIconResolver.resolve(db({}), themeWith('favicon-32x32.png', 'favicon.svg', 'apple-touch-icon.png'));
    expect(icon.favicon.source).toBe(SiteIconSource.THEME);
    expect(icon.favicon.file).toBe('favicon.svg');
    expect(icon.favicon.path).toBe('/api/themes/aurora/ui/favicon.svg');
    expect(icon.appleTouchIcon.file).toBe('apple-touch-icon.png');
  });

  it('falls through a picked file that is gone or private, rather than serving a broken icon', async () => {
    const icon = await SiteIconResolver.resolve(
      db({ '_system_meta:site_icon': { value: '9' }, 'media:9': { id: 9, path: 'secret.png', visibility: 'private' } }),
      themeWith('favicon.ico'),
    );
    expect(icon.favicon.source).toBe(SiteIconSource.THEME);
  });

  it("is the platform's mark when there is no setting and no theme icon", async () => {
    const bare = await SiteIconResolver.resolve(db({}), themeWith());
    expect(bare.favicon.isPlatform).toBe(true);
    expect(bare.favicon.path).toBe('');
    expect((await SiteIconResolver.resolve(db({}), null)).appleTouchIcon.isPlatform).toBe(true);
  });

  it('crosses the payload and reads back as the same choice', async () => {
    const icon = await SiteIconResolver.resolve(db({}), themeWith('favicon.png'));
    const back = SiteIcon.from(JSON.parse(JSON.stringify(icon)));
    expect(back.favicon.source).toBe(SiteIconSource.THEME);
    expect(back.favicon.path).toBe(icon.favicon.path);
    expect(back.themeFavicon.file).toBe('favicon.png');
    expect(SiteIcon.from(undefined).favicon.isPlatform).toBe(true);
  });
});
