import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginPlatformHandoffs } from '@core/plugin/platform/plugin-platform-handoffs';
import { HandoffsTable } from '@core/plugin/platform/tests/handoffs-table';
import type { IPluginPlatformTicket } from '@core/plugin/platform/interfaces/plugin-platform-ticket.interface';

/** A used ticket is used for good, and what it carries is handed over once, to whoever spends the handoff first. */
describe('PluginPlatformHandoffs', () => {
  beforeEach(() => { process.env.SECRET_KEY = 'test-key-for-platform-handoffs'; });
  afterEach(() => { delete process.env.SECRET_KEY; });

  const now = 1_700_000_000_000;
  const ticket = (nonce = 'n1'): IPluginPlatformTicket => ({
    slug: 'replies', tenantId: '42', userId: '7', nonce, exp: now + 30 * 60_000,
    returnTo: 'https://site.example/admin/replies', completeUrl: 'https://site.example/api/v1/plugins/replies/connection/complete',
  });
  const setup = () => {
    const table = new HandoffsTable();
    return { table, handoffs: new PluginPlatformHandoffs(table as any) };
  };

  it('parks the claim and hands it over once', async () => {
    const { handoffs } = setup();
    const handoff = await handoffs.park(ticket(), ['page-a', ' page-a ', ''], { token: 'secret' }, now);
    expect(handoff).toMatch(/^[0-9a-f]{64}$/);
    expect(await handoffs.spend('replies', handoff, now + 1000)).toEqual({
      tenantId: '42', userId: '7', keys: ['page-a'], payload: { token: 'secret' }, returnTo: 'https://site.example/admin/replies',
    });
    expect(await handoffs.spend('replies', handoff, now + 2000)).toBeNull();
  });

  it('stores neither the handoff nor the payload in the clear, and drops the payload once spent', async () => {
    const { table, handoffs } = setup();
    const handoff = await handoffs.park(ticket(), ['page-a'], { token: 'secret' }, now);
    const stored = JSON.stringify(table.rows);
    expect(stored).not.toContain(handoff);
    expect(stored).not.toContain('secret');
    await handoffs.spend('replies', handoff, now);
    expect(table.rows[0]).toMatchObject({ state: 'spent', payload: null });
  });

  it('refuses a ticket the second time, whether it was parked or abandoned', async () => {
    const { handoffs } = setup();
    expect(await handoffs.park(ticket('a'), ['page-a'], undefined, now)).not.toBe('');
    expect(await handoffs.park(ticket('a'), ['page-b'], undefined, now)).toBe('');
    expect(await handoffs.abandon(ticket('a'), now)).toBe(false);
    expect(await handoffs.abandon(ticket('b'), now)).toBe(true);
    expect(await handoffs.park(ticket('b'), ['page-b'], undefined, now)).toBe('');
  });

  it('lets only one of two racing requests spend a handoff', async () => {
    const { handoffs } = setup();
    const handoff = await handoffs.park(ticket(), ['page-a'], undefined, now);
    const results = await Promise.all([handoffs.spend('replies', handoff, now), handoffs.spend('replies', handoff, now)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('refuses an expired handoff, and spends it anyway', async () => {
    const { table, handoffs } = setup();
    const handoff = await handoffs.park(ticket(), ['page-a'], undefined, now);
    expect(await handoffs.spend('replies', handoff, now + PluginPlatformHandoffs.HANDOFF_LIFETIME_MS)).toBeNull();
    expect(table.rows[0].state).toBe('spent');
  });

  it('refuses another plugin\'s handoff, unknown values and nothing', async () => {
    const { handoffs } = setup();
    const handoff = await handoffs.park(ticket(), ['page-a'], undefined, now);
    expect(await handoffs.spend('other', handoff, now)).toBeNull();
    expect(await handoffs.spend('replies', 'f'.repeat(64), now)).toBeNull();
    expect(await handoffs.spend('replies', undefined, now)).toBeNull();
    expect(await handoffs.spend('replies', handoff, now)).not.toBeNull();
  });

  it('prunes rows whose ticket and handoff have both run out, and keeps live ones', async () => {
    const { table, handoffs } = setup();
    await handoffs.park(ticket('old'), ['page-a'], undefined, now);
    await handoffs.park(ticket('new'), ['page-b'], undefined, now + 31 * 60_000);
    expect(table.rows.map((row) => row.nonce)).toEqual(['new']);
  });
});
