import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { TenantMode } from '@core/tenant/tenant-mode';
import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { PlatformContextProxy } from '@core/plugin/context/platform';
import { PluginPlatformRoute } from '@core/plugin/context/plugin-platform-route';
import { HandoffsTable } from '@core/plugin/platform/tests/handoffs-table';

/** One table fake that serves both the handoffs and the claims (rows of each never share a shape that matters here). */
class PlatformTables {
  readonly byName = new Map<string, HandoffsTable>();
  private table = (name: string) => this.byName.get(name) ?? this.byName.set(name, new HandoffsTable()).get(name)!;
  findOne = (name: string, where: any) => this.table(name).findOne(name, where);
  find = (name: string, query: any) => this.table(name).find(name, query);
  insert = (name: string, row: any) => {
    if (name.includes('claims') && this.table(name).rows.some((r) => r.plugin_slug === row.plugin_slug && r.claim_key === row.claim_key)) throw new Error('unique violation');
    return this.table(name).insert(name, { nonce: `${name}:${this.table(name).rows.length}`, ...row });
  };
  update = (name: string, where: any, values: any) => this.table(name).update(name, where, values);
  delete = (name: string, where: any) => this.table(name).delete(name, where);
}

/**
 * The attack this binding defeats: an admin of site A mints a connect link and sends it to the owner
 * of an account, who approves the provider's dialog. The account must NOT end up with site A.
 */
describe('context.platform connect binding', () => {
  const as = <T>(tenantId: string, sessionUserId: string | undefined, work: () => Promise<T>) =>
    RequestContextUtils.storage.run({ tenantId, sessionUserId, adminOrigin: 'https://a.example' } as any, work);
  const platform = <T>(work: () => Promise<T>) => RequestContextUtils.storage.run({} as any, work);

  let db: PlatformTables;
  let ctx: ReturnType<typeof PlatformContextProxy.createPlatformProxy>;

  beforeEach(() => {
    process.env.SECRET_KEY = 'test-key-for-platform-binding';
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    vi.spyOn(SiteBaseUrl, 'consoleOrigin').mockResolvedValue('https://a.example');
    vi.spyOn(SiteBaseUrl, 'consoleMount').mockResolvedValue('');
    vi.spyOn(ApplicationUrlUtils, 'readAppBaseUrlFromEnvironment').mockReturnValue('https://api.example');
    db = new PlatformTables();
    ctx = PlatformContextProxy.createPlatformProxy({ db } as any, { manifest: { slug: 'replies', platform: true } });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    TenantMode.reset();
    delete process.env.SECRET_KEY;
  });

  const ticketOf = (link: string) => new URL(link).searchParams.get('ticket')!;
  const handoffOf = (continueTo: string) => new URL(continueTo).searchParams.get('handoff')!;
  const link = () => as('1', '7', () => ctx.connectUrl('connect', { completePath: 'connection/complete', returnTo: '/admin/replies' }));

  it('mints a link only for a signed-in account', async () => {
    await expect(as('1', undefined, () => ctx.connectUrl('connect', { completePath: 'connection/complete' }))).rejects.toThrow(PluginPlatformRoute.NEEDS_ACCOUNT);
  });

  it('refuses a completePath that is not one of the plugin\'s own tenant routes', async () => {
    for (const completePath of ['', 'platform/finish', '../other/x', 'done?x=1', 'a\\b']) {
      await expect(as('1', '7', () => ctx.connectUrl('connect', { completePath }))).rejects.toThrow(/completePath/);
    }
  });

  it('sends the browser back to the console that asked, and grants the keys there to the same account', async () => {
    const ticket = ticketOf(await link());
    const claimed = await platform(() => ctx.claim(ticket, ['page-x'], { token: 'page-token' }));
    expect(claimed.valid).toBe(true);
    expect(claimed.continueTo.startsWith(`https://a.example${ApiPathUtils.pluginPath('replies', 'connection/complete')}?handoff=`)).toBe(true);

    const done = await as('1', '7', () => ctx.complete(handoffOf(claimed.continueTo)));
    expect(done).toEqual({ valid: true, granted: ['page-x'], refused: [], payload: { token: 'page-token' }, returnTo: 'https://a.example/admin/replies' });
    expect(await as('1', '7', () => ctx.claims())).toEqual(['page-x']);
  });

  it('comes back through the site\'s console path, where the console session is', async () => {
    vi.spyOn(SiteBaseUrl, 'consoleMount').mockResolvedValue('/admin');
    const ticket = ticketOf(await link());
    const claimed = await platform(() => ctx.claim(ticket, ['page-x'], {}));
    expect(claimed.continueTo.startsWith(`https://a.example/admin${ApiPathUtils.pluginPath('replies', 'connection/complete')}?handoff=`)).toBe(true);
    const done = await as('1', '7', () => ctx.complete(handoffOf(claimed.continueTo)));
    expect(done.returnTo).toBe('https://a.example/admin/replies');
  });

  it('grants nothing on the platform side, and a ticket only once', async () => {
    const ticket = ticketOf(await link());
    await platform(() => ctx.claim(ticket, ['page-x'], {}));
    expect(await as('1', '7', () => ctx.claims())).toEqual([]);
    expect(await platform(() => ctx.claim(ticket, ['page-y'], {}))).toEqual({ valid: false, continueTo: '' });
    expect(await platform(() => ctx.abandon(ticket))).toEqual({ valid: false, returnTo: '' });
  });

  it('refuses the forwarded link: the victim has no session on site A, and the handoff burns', async () => {
    const ticket = ticketOf(await link());
    const claimed = await platform(() => ctx.claim(ticket, ['page-x'], { token: 'page-token' }));
    const handoff = handoffOf(claimed.continueTo);

    const victim = await as('1', undefined, () => ctx.complete(handoff));
    expect(victim).toMatchObject({ valid: false, granted: [], payload: null });
    // The attacker, who IS signed in on site A, cannot replay what the victim's browser carried.
    expect((await as('1', '7', () => ctx.complete(handoff))).valid).toBe(false);
    expect(await as('1', '7', () => ctx.claims())).toEqual([]);
  });

  it('refuses another account on the same site, and another site entirely', async () => {
    const first = await platform(async () => ctx.claim(ticketOf(await link()), ['page-x'], {}));
    expect(await as('1', '8', () => ctx.complete(handoffOf(first.continueTo)))).toMatchObject({ valid: false, returnTo: 'https://a.example/admin/replies' });

    const second = await platform(async () => ctx.claim(ticketOf(await link()), ['page-x'], {}));
    expect(await as('2', '7', () => ctx.complete(handoffOf(second.continueTo)))).toMatchObject({ valid: false, returnTo: '' });
    expect(await as('1', '7', () => ctx.complete(handoffOf(second.continueTo)))).toMatchObject({ valid: false });
  });

  it('keeps each half in its own scope', async () => {
    const ticket = ticketOf(await link());
    await expect(as('1', '7', () => ctx.claim(ticket, ['page-x'], {}))).rejects.toThrow(PluginPlatformRoute.INSIDE_TENANT);
    await expect(platform(() => ctx.complete('x'))).rejects.toThrow(PluginPlatformRoute.NEEDS_TENANT);
  });
});
