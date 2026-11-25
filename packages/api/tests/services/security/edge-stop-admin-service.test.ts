import { describe, expect, it } from 'vitest';
import { EdgeStopAdminService } from '@api/services/security/edge-stop-admin-service';

describe('EdgeStopAdminService.block', () => {
  const run = async (stored: string) => {
    const writes: string[] = [];
    const db = {
      withPlatformAdmin: async (fn: () => Promise<unknown>) => fn(),
      queryRaw: async (sql: string, params: unknown[]) => (sql.startsWith('SELECT') ? [{ value: stored }] : (writes.push(String(params[1])), [])),
    };
    const manager = { db, audit: { logAction: () => undefined }, hooks: { emit: () => undefined } };
    const stop = { id: 1, active: true, address: '2a01:4f8:1c19:96de::/64' };
    const store: any = { find: async () => stop, release: async () => true };
    const service = new EdgeStopAdminService(manager, store, { notify: async () => undefined } as any);
    expect(await service.block(1, { email: 'op@test' })).toBe(true);
    return writes;
  };

  it('blocks an IPv6 stop as its /64', async () => {
    expect(await run('203.0.113.1')).toEqual(['203.0.113.1\n2a01:4f8:1c19:96de::/64']);
  });

  it('does not add a /64 that is already blocked', async () => {
    expect(await run('2a01:4f8:1c19:96de::/64')).toEqual([]);
    expect(await run('2a01:4f8::/32')).toEqual([]);
  });

  it('adds the /64 when only a narrower entry contains its first address', async () => {
    expect(await run('2a01:4f8:1c19:96de::/128')).toEqual(['2a01:4f8:1c19:96de::/128\n2a01:4f8:1c19:96de::/64']);
    expect(await run('2a01:4f8:1c19:96de::')).toEqual(['2a01:4f8:1c19:96de::\n2a01:4f8:1c19:96de::/64']);
  });
});
