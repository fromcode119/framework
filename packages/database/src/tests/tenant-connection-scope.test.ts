import { describe, expect, it } from 'vitest';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { TenantBindingSql } from '@database/dialects/postgres/tenant/tenant-binding-sql';
import { TenantBindingKey } from '@database/dialects/postgres/tenant/tenant-binding-key';

TenantBindingKey.use('test-key');

const OPEN = TenantBindingSql.openStatement();
const BIND = TenantBindingSql.bindStatement();
const stateOf = (tenant: string, platform: 'on' | 'off') => (tenant ? `tenant:${tenant}` : platform === 'on' ? 'platform' : 'none');
/** A connection's FIRST binding: opened, signed over `state:pid`. */
const opened = (tenant: string, platform: 'on' | 'off', pid: number) => ({
  text: OPEN,
  values: [stateOf(tenant, platform), TenantBindingKey.sign(`${stateOf(tenant, platform)}:${pid}`)],
});
/** A later binding: the next counter, signed over `state:pid:nonce:counter` (FakeClient's nonce is `nonce-<pid>`). */
const rebound = (tenant: string, platform: 'on' | 'off', pid: number, counter = 1) => ({
  text: BIND,
  values: [stateOf(tenant, platform), counter, TenantBindingKey.sign(`${stateOf(tenant, platform)}:${pid}:nonce-${pid}:${counter}`)],
});
const hasCall = (calls: Array<{ text: string; values?: unknown[] }>, expected: { text: string; values: unknown[] }) =>
  calls.some((call) => call.text === expected.text && JSON.stringify(call.values) === JSON.stringify(expected.values));

class FakeClient {
  readonly calls: Array<{ text: string; values?: unknown[] }> = [];
  released = false;
  /** What `pg` learns on connect — the pid a binding is signed for. */
  readonly processID: number;
  constructor(readonly id: number) { this.processID = 1000 + id; }
  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    return { rows: text === OPEN ? [{ nonce: `nonce-${this.processID}` }] : [] };
  }
  releasedWith: unknown = undefined;
  release(error?: unknown) { this.released = true; this.releasedWith = error; }
}

/** A client whose reset fails — left mid-transaction, or with a broken session. */
class UnclearableClient extends FakeClient {
  async query(text: string, values?: unknown[]) {
    if (text === BIND && values?.[0] === 'none') throw new Error('current transaction is aborted');
    return super.query(text, values);
  }
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
  it('destroys a client whose tenant cannot be cleared, instead of lending it on still bound to that tenant', async () => {
    const client = new UnclearableClient(1);
    const pool = { clients: [client], connect: async () => client as any };
    await TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('select 1');
    });
    expect(client.released).toBe(true);
    expect(client.releasedWith).toBeInstanceOf(Error);
  });

  it('does the same for a statement that arrives after the scope closed', async () => {
    const client = new UnclearableClient(1);
    const pool = { connect: async () => client as any };
    let late: any;
    await TenantConnectionScope.run(pool as any, 't1', async () => { late = TenantConnectionScope.currentClient(); });
    await late.query('select after close');
    expect(client.releasedWith).toBeInstanceOf(Error);
  });

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
    expect(pool.clients[0].calls[0]).toEqual(opened('t1', 'off', 1001));
    expect(texts.slice(1, 3)).toEqual(['select 1', 'select 2']);
    expect(hasCall(pool.clients[0].calls, rebound('', 'off', 1001))).toBe(true);
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
    expect(pool.clients[1].calls[0]).toEqual(opened('t1', 'off', 1002));
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
    expect(calls[0]).toEqual(opened('', 'on', 1001));
    // Never bound to a site on the way.
    expect(calls.some((call) => String(call.values?.[0] ?? '').startsWith('tenant:'))).toBe(false);
    expect(hasCall(calls, rebound('', 'off', 1001))).toBe(true);
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
    expect(poolA.clients[0].calls[0].values?.[0]).toBe('tenant:a');
    expect(poolB.clients[0].calls.map((c) => c.text)).toContain('from b');
    expect(poolB.clients[0].calls[0].values?.[0]).toBe('tenant:b');
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
    expect(pool.clients[1].calls[0]).toEqual(opened('t1', 'off', 1002));
    expect(texts).toContain('trailing audit write');
    expect(hasCall(pool.clients[1].calls, rebound('', 'off', 1002))).toBe(true);
  });

  it('keeps the platform-admin marker on a one-shot client for a closed platform scope', async () => {
    const pool = new FakePool();
    let late: ReturnType<typeof TenantConnectionScope.currentClient>;
    await TenantConnectionScope.runAsPlatformAdmin(pool as any, async () => { late = TenantConnectionScope.currentClient(); });
    await late!.query('late platform write');
    expect(pool.clients).toHaveLength(1);
    expect(pool.clients[0].released).toBe(true);
    expect(pool.clients[0].calls[0]).toEqual(opened('', 'on', 1001));
    expect(hasCall(pool.clients[0].calls, rebound('', 'off', 1001))).toBe(true);
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

  /**
   * THE DDL POOL MUST STILL BE THE DDL POOL AFTER A SCOPE.
   *
   * `markAsPlatformConnection` sets the marker on the pool's `connect` event — once per physical
   * connection. A client that had been through any scope came back with the marker cleared, and
   * `connect` does not fire on reuse, so every later untenanted platform write on that client was
   * refused with "new row violates row-level security policy for _system_meta" — from code that had
   * done nothing wrong. Observed at boot the moment anything opened a scope during schema sync.
   */
  it('restores the platform marker when releasing a client of the PLATFORM pool', async () => {
    const pool = new FakePool();
    (pool as any)[Symbol.for('fromcode.platformPool')] = true;

    await TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('SELECT 1');
    });

    // Back to acting for the platform, not switched off.
    expect(hasCall(pool.clients[0].calls, rebound('', 'on', 1001))).toBe(true);
    expect(hasCall(pool.clients[0].calls, rebound('', 'off', 1001))).toBe(false);
  });

  it('still switches the marker OFF for an ordinary pool', async () => {
    const pool = new FakePool();

    await TenantConnectionScope.run(pool as any, 't1', async () => {
      await TenantConnectionScope.currentClient()!.query('SELECT 1');
    });

    expect(hasCall(pool.clients[0].calls, rebound('', 'off', 1001))).toBe(true);
  });
});
