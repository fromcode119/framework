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

  const db = (rows: Record<string, any>) => ({
    findOne: vi.fn(async (table: string, where: Record<string, any>) => rows[`${table}:${where.id ?? where.key}`] ?? null),
  });

  it('is the picked file on the site host', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://regodue.com');
    const media = db({ 'media:91': { id: 91, path: 'logo-91.png', visibility: 'public' } });
    expect(await EmailLogoUrl.resolve(media, '91')).toBe('https://regodue.com/uploads/logo-91.png');
  });

  it('is empty when nothing is picked, the file is gone or private, or the site has no address', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://regodue.com');
    const media = db({ 'media:5': { id: 5, path: 'secret.png', visibility: 'private' } });
    expect(await EmailLogoUrl.resolve(media, '')).toBe('');
    expect(await EmailLogoUrl.resolve(media, null)).toBe('');
    expect(await EmailLogoUrl.resolve(media, 'abc')).toBe('');
    expect(await EmailLogoUrl.resolve(media, '404')).toBe('');
    expect(await EmailLogoUrl.resolve(media, '5')).toBe('');

    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('');
    const kept = db({ 'media:91': { id: 91, path: 'logo-91.png', visibility: 'public' } });
    expect(await EmailLogoUrl.resolve(kept, '91')).toBe('');
  });

  it('reaches a plugin as context.email.logoUrl(), from the setting the site saved', async () => {
    vi.spyOn(SiteBaseUrl, 'forCurrentSite').mockResolvedValue('https://regodue.com');
    const manager: any = {
      integrations: { email: { send: async () => undefined } },
      db: db({ '_system_meta:email_logo': { key: 'email_logo', value: '91' }, 'media:91': { id: 91, path: 'logo-91.png', visibility: 'public' } }),
    };
    const email = EmailContextProxy.createEmailProxy({ manifest: { slug: 'reminders' } } as any, manager);
    expect(await email.logoUrl()).toBe('https://regodue.com/uploads/logo-91.png');
  });
});
