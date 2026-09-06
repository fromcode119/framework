import { describe, expect, it } from 'vitest';
import { BaseDialect } from '@database/dialects/base-dialect';

/**
 * The base class must NOT hand out a security property nobody implemented.
 *
 * An earlier version returned a permissive passthrough from `withTenant`, so every driver that did
 * not override it — MySQL, and any future driver — silently ran with no isolation and no error.
 * These tests exist so that default can never quietly come back.
 */
class UnimplementedDialect extends BaseDialect {}

describe('BaseDialect tenant isolation default', () => {
  it('declares NO isolation support by default', () => {
    expect(new UnimplementedDialect().supportsTenantIsolation()).toBe(false);
  });

  it('REFUSES a tenant-scoped call rather than running it unisolated', async () => {
    const dialect = new UnimplementedDialect();
    await expect(dialect.withTenant('t1', async () => 'ran'))
      .rejects.toThrow(/no tenant isolation strategy/i);
  });

  it('never executes the callback when it refuses', async () => {
    const dialect = new UnimplementedDialect();
    let ran = false;
    await expect(dialect.withTenant('t1', async () => { ran = true; return 1; })).rejects.toThrow();
    expect(ran).toBe(false);
  });

  it('names the driver in the refusal, so the log says which one is unimplemented', async () => {
    await expect(new UnimplementedDialect().withTenant('t1', async () => 1))
      .rejects.toThrow(/UnimplementedDialect/);
  });
});
