import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { TenantClientParking } from '@database/tenant/tenant-client-parking';
import { TenantBindingSql } from '@database/dialects/postgres/tenant/tenant-binding-sql';
import { TenantBindingKey } from '@database/dialects/postgres/tenant/tenant-binding-key';

TenantBindingKey.use('test-key');

const OPEN = TenantBindingSql.openStatement();
const BIND = TenantBindingSql.bindStatement();

class FakeClient {
  readonly calls: Array<{ text: string; values?: unknown[] }> = [];
  released = false;
  releasedWith: unknown = undefined;
  readonly processID: number;
  constructor(readonly id: number, private readonly unclearable = false) { this.processID = 1000 + id; }
  async query(text: string, values?: unknown[]) {
    if (this.unclearable && text === BIND && values?.[0] === 'none') throw new Error('current transaction is aborted');
    this.calls.push({ text, values });
    return { rows: text === OPEN ? [{ nonce: `nonce-${this.processID}` }] : [] };
  }
  release(error?: unknown) { this.released = true; this.releasedWith = error; }
  /** Every site this client was bound to, in order — `none` is a clear. */
  get bindings(): string[] { return this.calls.filter((c) => c.text === OPEN || c.text === BIND).map((c) => String(c.values?.[0])); }
  get statements(): string[] { return this.calls.filter((c) => c.text !== OPEN && c.text !== BIND).map((c) => c.text); }
}

class FakePool {
  readonly clients: FakeClient[] = [];
  waitingCount = 0;
  constructor(private readonly unclearable = false) {}
  async connect() {
    const client = new FakeClient(this.clients.length + 1, this.unclearable);
    this.clients.push(client);
    return client as any;
  }
}

const statement = (text: string) => TenantConnectionScope.currentClient()!.query(text);

describe('TenantClientParking', () => {
  afterEach(() => vi.useRealTimers());

  it('binds ONE client for a run of calls, and clears and releases it on close', async () => {
    const pool = new FakePool();
    const parking = new TenantClientParking(pool as any, 't1');
    await parking.run(() => statement('select 1'));
    await parking.run(() => statement('select 2'));
    await parking.run(() => statement('select 3'));
    expect(pool.clients).toHaveLength(1);
    expect(pool.clients[0].bindings).toEqual(['tenant:t1']);
    expect(pool.clients[0].statements).toEqual(['select 1', 'select 2', 'select 3']);
    expect(pool.clients[0].released).toBe(false);
    await parking.close();
    expect(pool.clients[0].bindings).toEqual(['tenant:t1', 'none']);
    expect(pool.clients[0].released).toBe(true);
  });

  it('gives a concurrent run its OWN client, so one run never shares a session with another', async () => {
    const pool = new FakePool();
    const parking = new TenantClientParking(pool as any, 't1');
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const first = parking.run(async () => { await statement('BEGIN'); await held; await statement('COMMIT'); });
    await new Promise((resolve) => setImmediate(resolve));
    await parking.run(() => statement('select during transaction'));
    release();
    await first;
    expect(pool.clients).toHaveLength(2);
    expect(pool.clients[0].statements).toEqual(['BEGIN', 'COMMIT']);
    expect(pool.clients[1].statements).toEqual(['select during transaction']);
    for (const client of pool.clients) expect(client.bindings[0]).toBe('tenant:t1');
    await parking.close();
    expect(pool.clients.every((client) => client.released)).toBe(true);
  });

  it('never parks a client while a transaction is still open', async () => {
    const pool = new FakePool();
    const parking = new TenantClientParking(pool as any, 't1');
    await parking.run(() => statement('BEGIN'));
    expect(pool.clients[0].released).toBe(true);
    await parking.run(() => statement('select 1'));
    expect(pool.clients).toHaveLength(2);
    await parking.close();
  });

  it('hands the client back at once when somebody is queued for the pool', async () => {
    const pool = new FakePool();
    const parking = new TenantClientParking(pool as any, 't1');
    pool.waitingCount = 1;
    await parking.run(() => statement('select 1'));
    expect(pool.clients[0].released).toBe(true);
    expect(pool.clients[0].bindings).toEqual(['tenant:t1', 'none']);
  });

  it('hands an idle parked client back after IDLE_MS, and the next run binds a fresh one', async () => {
    vi.useFakeTimers();
    const pool = new FakePool();
    const parking = new TenantClientParking(pool as any, 't1');
    await parking.run(() => statement('select 1'));
    expect(pool.clients[0].released).toBe(false);
    await vi.advanceTimersByTimeAsync(TenantClientParking.IDLE_MS + 1);
    expect(pool.clients[0].released).toBe(true);
    await parking.run(() => statement('select 2'));
    expect(pool.clients).toHaveLength(2);
    expect(pool.clients[1].bindings).toEqual(['tenant:t1']);
    await parking.close();
  });

  it('a statement trailing a finished run takes a one-shot client — never the parked one', async () => {
    const pool = new FakePool();
    const parking = new TenantClientParking(pool as any, 't1');
    let late: ReturnType<typeof TenantConnectionScope.currentClient>;
    await parking.run(async () => { late = TenantConnectionScope.currentClient(); await late!.query('in run'); });
    await late!.query('trailing write');
    expect(pool.clients[0].statements).toEqual(['in run']);
    expect(pool.clients[1].statements).toEqual(['trailing write']);
    expect(pool.clients[1].released).toBe(true);
    await parking.close();
  });

  it('a run still going when the parking closes gives its own client back', async () => {
    const pool = new FakePool();
    const parking = new TenantClientParking(pool as any, 't1');
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const running = parking.run(async () => { await statement('select 1'); await held; });
    await new Promise((resolve) => setImmediate(resolve));
    await parking.close();
    release();
    await running;
    expect(pool.clients[0].released).toBe(true);
    expect(pool.clients[0].bindings).toEqual(['tenant:t1', 'none']);
  });

  it('destroys a parked client whose binding cannot be cleared', async () => {
    const pool = new FakePool(true);
    const parking = new TenantClientParking(pool as any, 't1');
    await parking.run(() => statement('select 1'));
    await parking.close();
    expect(pool.clients[0].releasedWith).toBeInstanceOf(Error);
  });

  it('keeps each site on its own parking', async () => {
    const pool = new FakePool();
    const a = new TenantClientParking(pool as any, 'a');
    const b = new TenantClientParking(pool as any, 'b');
    await a.run(() => statement('from a'));
    await b.run(() => statement('from b'));
    await a.run(() => statement('from a again'));
    expect(pool.clients.map((client) => client.bindings[0])).toEqual(['tenant:a', 'tenant:b']);
    expect(pool.clients[0].statements).toEqual(['from a', 'from a again']);
    await Promise.all([a.close(), b.close()]);
  });

  it('refuses an empty tenant id', () => {
    expect(() => new TenantClientParking(new FakePool() as any, ' ')).toThrow(/tenant/i);
  });
});
