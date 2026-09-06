import { describe, expect, it } from 'vitest';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { TenantRlsSql } from '@database/tenant/tenant-rls-sql';

class FakeClient {
  readonly calls: Array<{ text: string; values?: unknown[] }> = [];
  released = false;
  constructor(readonly id: number) {}
  async query(text: string, values?: unknown[]) { this.calls.push({ text, values }); return { rows: [] }; }
  release() { this.released = true; }
}

/** Hands out a fresh counting client per `connect`, so re-acquisition after a release is visible. */
class FakePool {
  readonly clients: FakeClient[] = [];
  async connect() {
    const client = new FakeClient(this.clients.length + 1);
    this.clients.push(client);
    return client as any;
  }
}

describe('TenantConnectionScope', () => {
  it('takes no client for a scope that issues no statement', async () => {
    const pool = new FakePool();
    await TenantConnectionScope.run(pool as any, 't1', async () => {
      expect(TenantConnectionScope.currentClient()).toBeDefined();
    });
    expect(pool.clients).toHaveLength(0);
  });

  it('sets the tenant on the held client before the FIRST statement, then clears and releases it', async () => {
    const pool = new FakePool();
    await TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('select 1');
      await TenantConnectionScope.currentClient()!.query('select 2');
    });
    expect(pool.clients).toHaveLength(1);
    const texts = pool.clients[0].calls.map((call) => call.text);
    expect(pool.clients[0].calls[0]).toEqual({ text: TenantRlsSql.setTenantStatement(), values: ['t1'] });
    expect(texts.slice(1, 3)).toEqual(['select 1', 'select 2']);
    expect(texts).toContain(TenantRlsSql.resetTenantStatement());
    expect(pool.clients[0].released).toBe(true);
    expect(TenantConnectionScope.currentClient()).toBeUndefined();
  });

  it('clears and releases even when the body throws', async () => {
    const pool = new FakePool();
    await expect(TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('select 1');
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(pool.clients[0].released).toBe(true);
    expect(TenantConnectionScope.currentClient()).toBeUndefined();
  });

  it('releaseCurrent hands the client back mid-scope; the next statement takes a fresh one with the tenant set again', async () => {
    const pool = new FakePool();
    await TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('before wait');
      await TenantConnectionScope.releaseCurrent();
      expect(pool.clients[0].released).toBe(true);
      await TenantConnectionScope.currentClient()!.query('after wait');
    });
    expect(pool.clients).toHaveLength(2);
    expect(pool.clients[1].calls[0]).toEqual({ text: TenantRlsSql.setTenantStatement(), values: ['t1'] });
    expect(pool.clients[1].calls[1].text).toBe('after wait');
    expect(pool.clients[1].released).toBe(true);
  });

  it('keeps the client while a transaction is open, even when asked to release', async () => {
    const pool = new FakePool();
    await TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('BEGIN');
      await TenantConnectionScope.currentClient()!.query('insert parent');
      await TenantConnectionScope.releaseCurrent();
      expect(pool.clients[0].released).toBe(false);
      await TenantConnectionScope.currentClient()!.query('insert child');
      await TenantConnectionScope.currentClient()!.query('COMMIT');
      await TenantConnectionScope.releaseCurrent();
      expect(pool.clients[0].released).toBe(true);
    });
    expect(pool.clients).toHaveLength(1);
    expect(pool.clients[0].calls.map((c) => c.text).slice(1, 5)).toEqual(['BEGIN', 'insert parent', 'insert child', 'COMMIT']);
  });

  it('a platform-admin scope runs untenanted with the marker set', async () => {
    const pool = new FakePool();
    await TenantConnectionScope.runAsPlatformAdmin(pool as any, async () => {
      await TenantConnectionScope.currentClient()!.query('insert platform row');
    });
    const calls = pool.clients[0].calls;
    expect(calls[0]).toEqual({ text: TenantRlsSql.setPlatformAdminStatement(), values: ['on'] });
    expect(calls.some((call) => call.text === TenantRlsSql.setTenantStatement())).toBe(false);
    expect(calls.map((call) => call.text)).toContain(TenantRlsSql.resetPlatformAdminStatement());
  });

  it('refuses an empty tenant id', async () => {
    const pool = new FakePool();
    await expect(TenantConnectionScope.run(pool as any, '  ', async () => undefined)).rejects.toThrow(/tenant/i);
    expect(pool.clients).toHaveLength(0);
  });

  it('exposes no client outside a scope', () => {
    expect(TenantConnectionScope.currentClient()).toBeUndefined();
  });

  it('keeps concurrent scopes on their own pools', async () => {
    const poolA = new FakePool();
    const poolB = new FakePool();
    await Promise.all([
      TenantConnectionScope.run(poolA as any, 'a', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        await TenantConnectionScope.currentClient()!.query('from a');
      }),
      TenantConnectionScope.run(poolB as any, 'b', async () => {
        await TenantConnectionScope.currentClient()!.query('from b');
      }),
    ]);
    expect(poolA.clients[0].calls.map((c) => c.text)).toContain('from a');
    expect(poolA.clients[0].calls[0].values).toEqual(['a']);
    expect(poolB.clients[0].calls.map((c) => c.text)).toContain('from b');
    expect(poolB.clients[0].calls[0].values).toEqual(['b']);
  });
});

describe('TenantConnectionScope after the scope has closed', () => {
  /**
   * The request's scope closes when the response finishes or the client goes away — but the handler
   * may still be running (an audit write after `res.json`, a storefront request the frontend aborted
   * at its own deadline). Its next statement used to re-acquire a client into the closed store, which
   * nothing would ever release: ten such statements and the pool was empty for good.
   */
  it('a statement issued after close runs on a one-shot client that is released at once — never an orphan', async () => {
    const pool = new FakePool();
    let late: ReturnType<typeof TenantConnectionScope.currentClient>;
    await TenantConnectionScope.run(pool as any, 't1', async () => {
      late = TenantConnectionScope.currentClient();
      await late!.query('in scope');
    });
    expect(pool.clients).toHaveLength(1);
    expect(pool.clients[0].released).toBe(true);

    await late!.query('trailing audit write');
    await late!.query('second trailing statement');

    expect(pool.clients).toHaveLength(3);
    for (const client of pool.clients) expect(client.released).toBe(true);
    const texts = pool.clients[1].calls.map((call) => call.text);
    expect(pool.clients[1].calls[0]).toEqual({ text: TenantRlsSql.setTenantStatement(), values: ['t1'] });
    expect(texts).toContain('trailing audit write');
    expect(texts).toContain(TenantRlsSql.resetTenantStatement());
  });

  it('keeps the platform-admin marker on a one-shot client for a closed platform scope', async () => {
    const pool = new FakePool();
    let late: ReturnType<typeof TenantConnectionScope.currentClient>;
    await TenantConnectionScope.runAsPlatformAdmin(pool as any, async () => { late = TenantConnectionScope.currentClient(); });
    await late!.query('late platform write');
    expect(pool.clients).toHaveLength(1);
    expect(pool.clients[0].released).toBe(true);
    expect(pool.clients[0].calls[0]).toEqual({ text: TenantRlsSql.setPlatformAdminStatement(), values: ['on'] });
    expect(pool.clients[0].calls.map((c) => c.text)).toContain(TenantRlsSql.resetPlatformAdminStatement());
  });
});

describe('TenantConnectionScope.currentClient(pool)', () => {
  it('hands the scoped client only to the pool the scope was opened on; another pool (the DDL/owner manager) gets none', async () => {
    const appPool = new FakePool();
    const ddlPool = new FakePool();
    await TenantConnectionScope.run(appPool as any, 't1', async () => {
      expect(TenantConnectionScope.currentClient(appPool as any)).toBeDefined();
      expect(TenantConnectionScope.currentClient(ddlPool as any)).toBeUndefined();
      expect(TenantConnectionScope.currentClient()).toBeDefined();
    });
  });
});
