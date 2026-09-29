import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailLogoUrl } from '@core/email/email-logo-url';
import { EmailContextProxy } from '@core/plugin/context/email';
import { SiteBaseUrl } from '@core/tenant/site-base-url';

/**
 * The site's email logo is picked once (Settings → General) and every email carries it — the
 * framework's own and any plugin's. It must be addressed on the SITE's host: a site's uploads are
 * served per host, and a mail app fetches the image long after the send.
 */
describe('the site email logo', () => {
  afterEach(() => vi.restoreAllMocks());

  const noTheme = async () => null;
  const db = (rows: Record<string, any>) => ({
    findOne: vi.fn(async (table: string, where: Record<string, any>) => rows[`${table}:${where.id ?? where.key}`] ?? null),
  });

  it('is the picked file on the site host', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://shop.example');
    const media = db({ 'media:91': { id: 91, path: 'logo-91.png', visibility: 'public' } });
    expect(await EmailLogoUrl.resolve(media, '91', noTheme)).toBe('https://shop.example/uploads/logo-91.png');
  });

  it('is empty when nothing is picked, the file is gone or private, or the site has no address', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://shop.example');
    const media = db({ 'media:5': { id: 5, path: 'secret.png', visibility: 'private' } });
    expect(await EmailLogoUrl.resolve(media, '', noTheme)).toBe('');
    expect(await EmailLogoUrl.resolve(media, null, noTheme)).toBe('');
    expect(await EmailLogoUrl.resolve(media, 'abc', noTheme)).toBe('');
    expect(await EmailLogoUrl.resolve(media, '404', noTheme)).toBe('');
    expect(await EmailLogoUrl.resolve(media, '5', noTheme)).toBe('');

    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('');
    const kept = db({ 'media:91': { id: 91, path: 'logo-91.png', visibility: 'public' } });
    expect(await EmailLogoUrl.resolve(kept, '91', noTheme)).toBe('');
  });

  it("is a file from the site's active theme, when the picker's Theme tab chose it", async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://shop.example');
    const theme = async () => 'aurora';
    expect(await EmailLogoUrl.resolve(db({}), 'theme:logo-horizontal.png', theme))
      .toBe('https://shop.example/api/v1/themes/aurora/ui/logo-horizontal.png');
    expect(await EmailLogoUrl.resolve(db({}), 'theme:images/logo-black.png', theme))
      .toBe('https://shop.example/api/v1/themes/aurora/ui/images/logo-black.png');
  });

  it('is empty for a theme file with no active theme, or a path that climbs out of ui/', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://shop.example');
    expect(await EmailLogoUrl.resolve(db({}), 'theme:logo.png', noTheme)).toBe('');
    expect(await EmailLogoUrl.resolve(db({}), 'theme:../../secret.png', async () => 'aurora')).toBe('');
    expect(await EmailLogoUrl.resolve(db({}), 'theme:', async () => 'aurora')).toBe('');
  });

  it('reaches a plugin as context.email.logoUrl(), from the setting the site saved', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://shop.example');
    const manager: any = {
      integrations: { email: { send: async () => undefined } },
      db: db({ '_system_meta:email_logo': { key: 'email_logo', value: '91' }, 'media:91': { id: 91, path: 'logo-91.png', visibility: 'public' } }),
    };
    const email = EmailContextProxy.createEmailProxy({ manifest: { slug: 'epsilon' } } as any, manager, noTheme);
    expect(await email.logoUrl()).toBe('https://shop.example/uploads/logo-91.png');
  });
  it("hands a plugin the theme logo, from the theme the plugin's own paths report", async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://shop.example');
    const manager: any = {
      integrations: { email: { send: async () => undefined } },
      db: db({ '_system_meta:email_logo': { key: 'email_logo', value: 'theme:images/logo-black.png' } }),
    };
    const email = EmailContextProxy.createEmailProxy({ manifest: { slug: 'epsilon' } } as any, manager, async () => 'aurora');
    expect(await email.logoUrl()).toBe('https://shop.example/api/v1/themes/aurora/ui/images/logo-black.png');
  });
});
