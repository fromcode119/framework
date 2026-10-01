import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { StorefrontNoticeTokens } from '@core/storefront-notice/storefront-notice-tokens';
import { StorefrontNoticeDisplay } from '@core/storefront-notice/storefront-notice-display';
import { UiContextProxy } from '@core/plugin/context/ui';

/**
 * A one-time notice is shown to whoever holds the link, so the link is the only thing that may decide
 * what it says: not the address bar, not another site, not the other display.
 */
describe('storefront notice tokens', () => {
  afterEach(() => {
    TenantMode.reset();
    vi.useRealTimers();
  });

  /** `_system_meta` per site — the signing root lives there, one per site. */
  function siteManager(): any {
    const rows = new Map<string, Map<string, string>>();
    const table = () => {
      const site = String(RequestContextUtils.getTenantId() ?? '-');
      if (!rows.has(site)) rows.set(site, new Map());
      return rows.get(site)!;
    };
    return {
      db: {
        findOne: async (_t: string, where: { key: string }) => (table().has(where.key) ? { key: where.key, value: table().get(where.key) } : null),
        insert: async (_t: string, row: { key: string; value: string }) => { table().set(row.key, row.value); return row; },
        update: async (_t: string, where: { key: string }, patch: { value: string }) => { table().set(where.key, patch.value); return patch; },
        withTenant: async (_id: string, fn: () => Promise<unknown>) => fn(),
      },
    };
  }

  const onSite = <T>(tenantId: string, fn: () => Promise<T>) => RequestContextUtils.storage.run({ tenantId } as any, fn);
  const sites = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
  const notice = { tone: 'success', title: 'Your subscription is confirmed', body: 'Thank you.' };

  it('says what was minted, on the site it was minted for', async () => {
    sites();
    const tokens = new StorefrontNoticeTokens(siteManager());
    const token = await onSite('shop', () => tokens.mint(notice, StorefrontNoticeDisplay.BAR));
    expect(await tokens.verify(token, 'shop', StorefrontNoticeDisplay.BAR)).toEqual(notice);
  });

  it('is no notice on another site', async () => {
    sites();
    const tokens = new StorefrontNoticeTokens(siteManager());
    const token = await onSite('shop', () => tokens.mint(notice, StorefrontNoticeDisplay.BAR));
    expect(await tokens.verify(token, 'other', StorefrontNoticeDisplay.BAR)).toBeNull();
  });

  it('is no notice for the other display — a page token is never also the site-wide bar', async () => {
    sites();
    const tokens = new StorefrontNoticeTokens(siteManager());
    const token = await onSite('shop', () => tokens.mint(notice, StorefrontNoticeDisplay.PAGE));
    expect(await tokens.verify(token, 'shop', StorefrontNoticeDisplay.BAR)).toBeNull();
    expect(await tokens.verify(token, 'shop', StorefrontNoticeDisplay.PAGE)).toEqual(notice);
  });

  it('is no notice once its words are edited', async () => {
    sites();
    const tokens = new StorefrontNoticeTokens(siteManager());
    const token = await onSite('shop', () => tokens.mint(notice, StorefrontNoticeDisplay.BAR));
    const [version, payload, signature] = token.split('.');
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claim.t = 'You won a prize';
    const forged = `${version}.${Buffer.from(JSON.stringify(claim)).toString('base64url')}.${signature}`;
    expect(await tokens.verify(forged, 'shop', StorefrontNoticeDisplay.BAR)).toBeNull();
    expect(await tokens.verify('status=confirmed', 'shop', StorefrontNoticeDisplay.BAR)).toBeNull();
  });

  it('is no notice once it has expired', async () => {
    sites();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    const tokens = new StorefrontNoticeTokens(siteManager());
    const token = await onSite('shop', () => tokens.mint(notice, StorefrontNoticeDisplay.BAR, 60));
    vi.setSystemTime(new Date('2026-10-01T10:02:00Z'));
    expect(await tokens.verify(token, 'shop', StorefrontNoticeDisplay.BAR)).toBeNull();
  });

  it('refuses to mint without a site — "no site" is never every site', async () => {
    sites();
    const tokens = new StorefrontNoticeTokens(siteManager());
    await expect(tokens.mint(notice, StorefrontNoticeDisplay.BAR)).rejects.toThrow(/belongs to a site/);
  });

  it('reads an unknown tone as a neutral note, never a success', async () => {
    sites();
    const tokens = new StorefrontNoticeTokens(siteManager());
    const token = await onSite('shop', () => tokens.mint({ tone: 'celebration', title: 'Hi' }, StorefrontNoticeDisplay.BAR));
    expect((await tokens.verify(token, 'shop', StorefrontNoticeDisplay.BAR))?.tone).toBe('info');
  });

  it('builds a link to a path on THIS site only — never an open redirect', async () => {
    sites();
    const manager = siteManager();
    await expect(onSite('shop', () => UiContextProxy.noticeUrl(manager, 'https://evil.example/', notice))).rejects.toThrow(/path on the site/);
    await expect(onSite('shop', () => UiContextProxy.noticeUrl(manager, '//evil.example/', notice))).rejects.toThrow(/path on the site/);
    const url = await onSite('shop', () => UiContextProxy.noticeUrl(manager, '/', notice));
    expect(url).toMatch(/\/\?fc_notice=v1\./);
  });
});
