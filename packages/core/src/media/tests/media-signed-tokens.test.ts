import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { MediaSignedTokens } from '@core/media/media-signed-tokens';
import { MediaSignedAddress } from '@core/plugin/context/media-signed-address';

/**
 * A signed file address opens a private file to whoever holds it, so only the token may decide which file,
 * on which site and until when — never the address bar.
 */
describe('media signed tokens', () => {
  afterEach(() => TenantMode.reset());

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

  it('opens the file it was minted for, on its site', async () => {
    sites();
    const tokens = new MediaSignedTokens(siteManager());
    const token = await onSite('zen', () => tokens.mint('12309'));
    expect(await tokens.verify(token, 'zen')).toBe('12309');
  });

  it('opens nothing on another site', async () => {
    sites();
    const tokens = new MediaSignedTokens(siteManager());
    const token = await onSite('zen', () => tokens.mint('12309'));
    expect(await tokens.verify(token, 'shop')).toBeNull();
  });

  it('opens nothing once it has expired', async () => {
    sites();
    const tokens = new MediaSignedTokens(siteManager());
    const now = Date.now();
    const token = await onSite('zen', () => tokens.mint('12309', 60, now));
    expect(await tokens.verify(token, 'zen', now + 59_000)).toBe('12309');
    expect(await tokens.verify(token, 'zen', now + 61_000)).toBeNull();
  });

  it('opens nothing when the file in it was changed', async () => {
    sites();
    const tokens = new MediaSignedTokens(siteManager());
    const token = await onSite('zen', () => tokens.mint('12309'));
    const [version, payload, signature] = token.split('.');
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const forged = `${version}.${Buffer.from(JSON.stringify({ ...claim, m: '12343' })).toString('base64url')}.${signature}`;
    expect(await tokens.verify(forged, 'zen')).toBeNull();
    expect(await tokens.verify('v1.x', 'zen')).toBeNull();
    expect(await tokens.verify('', 'zen')).toBeNull();
  });

  it('cannot be minted outside a site, nor for something that is not a file id', async () => {
    sites();
    const tokens = new MediaSignedTokens(siteManager());
    await expect(tokens.mint('12309')).rejects.toThrow(/belongs to a site/);
    await expect(onSite('zen', () => tokens.mint('../etc'))).rejects.toThrow(/id of a stored file/);
  });

  it('lasts between thirty seconds and a day, ten minutes when not said', () => {
    expect(MediaSignedTokens.ttl(undefined)).toBe(600);
    expect(MediaSignedTokens.ttl(5)).toBe(30);
    expect(MediaSignedTokens.ttl(10 ** 9)).toBe(86_400);
    expect(MediaSignedTokens.ttl(300)).toBe(300);
  });

  it('names the address after the file type, never the stored name', () => {
    expect(MediaSignedAddress.fileName({ filename: 'live-50564-0718692e.MP4' })).toBe('file.mp4');
    expect(MediaSignedAddress.fileName({ filename: 'noext', originalName: 'sea.m4a' })).toBe('file.m4a');
    expect(MediaSignedAddress.fileName({ filename: 'noext' })).toBe('file');
  });

  // A token lasts a day at most: a phone that keeps files by their path must find one path per file, whatever the token.
  it('names the file in the path and carries the token in the query', async () => {
    vi.spyOn(MediaSignedTokens.prototype, 'mint').mockResolvedValue('v1.claim.sig');
    vi.spyOn(SiteBaseUrl, 'apiUrlForCurrentSite').mockImplementation(async (path: string) => `https://site.test${path}`);
    try {
      expect(await new MediaSignedAddress({} as any).of({ id: 42, filename: 'sea.mp3' }, 3600)).toMatch(/^https:\/\/site\.test\/.*\/media\/signed\/42\/file\.mp3\?t=v1\.claim\.sig$/);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
