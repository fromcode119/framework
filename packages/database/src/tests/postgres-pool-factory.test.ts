import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PostgresPoolFactory } from '@database/dialects/postgres/postgres-pool-factory';

describe('PostgresPoolFactory', () => {
  it('survives a connection the server closes, idle in the pool or checked out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pool = PostgresPoolFactory.open('postgresql://app@127.0.0.1:1/none');
    try {
      expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'), {} as any)).not.toThrow();

      const client = new EventEmitter() as any;
      client.query = vi.fn();
      pool.emit('connect', client);
      expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
      await pool.end();
    }
  });
});
