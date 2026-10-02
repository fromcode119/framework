import { describe, expect, it } from 'vitest';
import { PreparedStatements } from '@database/dialects/postgres/prepared-statements';
import { PostgresPoolFactory } from '@database/dialects/postgres/postgres-pool-factory';

/**
 * A statement the read path marks runs as a NAMED statement on the connection — prepared once, then
 * only bound and executed — with the same text and the same bound values. Everything else runs as
 * before, and a connection never holds more than its share of prepared statements.
 */
function connection(fail?: (config: any) => Error | null) {
  const sent: any[] = [];
  const client = {
    query: async (...args: any[]) => {
      sent.push(args);
      const error = fail?.(args[0]);
      if (error) throw error;
      return { rows: [] };
    },
  };
  PreparedStatements.install(client);
  return { client, sent };
}

describe('PreparedStatements', () => {
  it('runs a marked statement under a name derived from its text, with its values bound as before', async () => {
    const { client, sent } = connection();
    await client.query(PreparedStatements.mark('SELECT * FROM "t" WHERE "slug" = $1', ['a'], { rowMode: 'array' }));
    await client.query(PreparedStatements.mark('SELECT * FROM "t" WHERE "slug" = $1', ['b']));
    const [first, second] = sent.map((args) => args[0]);
    expect(first).toMatchObject({ text: 'SELECT * FROM "t" WHERE "slug" = $1', values: ['a'], rowMode: 'array' });
    expect(first.name).toMatch(/^fc_[0-9a-f]{24}_0$/);
    expect(second.name).toBe(first.name);
    expect(second.values).toEqual(['b']);
    expect(Object.getOwnPropertySymbols(first)).toEqual([]);
  });

  it('leaves unmarked statements exactly as they were sent', async () => {
    const { client, sent } = connection();
    await client.query('SELECT 1', [1]);
    await client.query({ text: 'SELECT 2', values: [] });
    expect(sent).toEqual([['SELECT 1', [1]], [{ text: 'SELECT 2', values: [] }]]);
  });

  it('prepares a callback-style call too (the pool\'s own path), answering through the same callback', async () => {
    const sent: any[] = [];
    let refuseOnce = true;
    const client = {
      query: (config: any, values: unknown, callback: (error: unknown, result?: unknown) => void) => {
        sent.push(config);
        if (refuseOnce && sent.length === 1) { refuseOnce = false; return callback(Object.assign(new Error('cached plan must not change result type'), { code: '0A000' })); }
        return callback(null, { rows: [config.name] });
      },
    };
    PreparedStatements.install(client);
    const result = await new Promise<any>((resolve, reject) => client.query(PreparedStatements.mark('SELECT 3', []), undefined, (error: unknown, rows: unknown) => (error ? reject(error) : resolve(rows))));
    expect(sent[0].name).toMatch(/^fc_[0-9a-f]{24}_0$/);
    expect(sent[1].name).toMatch(/^fc_[0-9a-f]{24}_1$/);
    expect(result.rows).toEqual([sent[1].name]);
  });

  it('holds at most PER_CONNECTION prepared statements; further texts run unnamed', async () => {
    const { client, sent } = connection();
    for (let i = 0; i <= PreparedStatements.PER_CONNECTION; i += 1) await client.query(PreparedStatements.mark(`SELECT ${i}`, []));
    const named = sent.filter((args) => args[0].name).length;
    expect(named).toBe(PreparedStatements.PER_CONNECTION);
    expect(sent[sent.length - 1][0].name).toBeUndefined();
  });

  it('prepares again under a new name when a table\'s columns changed under a prepared SELECT *', async () => {
    let refuseOnce = true;
    const { client, sent } = connection((config) => {
      if (refuseOnce && config.name) { refuseOnce = false; return Object.assign(new Error('cached plan must not change result type'), { code: '0A000' }); }
      return null;
    });
    await client.query(PreparedStatements.mark('SELECT * FROM "t"', []));
    expect(sent).toHaveLength(2);
    expect(sent[1][0].name).not.toBe(sent[0][0].name);
    expect(sent[1][0].text).toBe('SELECT * FROM "t"');
  });

  it('passes any other error through', async () => {
    const { client } = connection(() => Object.assign(new Error('boom'), { code: '42P01' }));
    await expect(client.query(PreparedStatements.mark('SELECT * FROM "gone"', []))).rejects.toThrow('boom');
  });
});

describe('PostgresPoolFactory', () => {
  it('keeps an unused connection for minutes, not pg\'s default 10 s', async () => {
    const pool: any = PostgresPoolFactory.open('postgres://user:pass@127.0.0.1:1/none');
    expect(pool.options.idleTimeoutMillis).toBe(PostgresPoolFactory.IDLE_TIMEOUT_MS);
    expect(PostgresPoolFactory.IDLE_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
    await pool.end();
  });
});
