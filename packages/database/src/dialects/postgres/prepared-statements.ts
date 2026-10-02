import { createHash } from 'crypto';

/**
 * Statements the read path runs again and again, prepared once per connection instead of parsed and
 * planned on every run.
 *
 * Every `find` went to Postgres unnamed, so the server parsed and planned the same text each time — on
 * one core, measured at more than half of the database's time per request. A statement the read path
 * MARKS is sent with a name derived from its text: the first run on a connection prepares it, later
 * runs only bind and execute. The values are still bound parameters; nothing about what runs changes.
 *
 * Bounded per connection (`PER_CONNECTION`): past it a connection runs further texts unnamed, so a
 * stream of distinct statements (an `IN` list of every length) cannot grow a backend's memory without
 * limit. A table whose columns changed makes Postgres refuse a prepared `SELECT *` ("cached plan must
 * not change result type"): the statement is then prepared again under a new name and run once more.
 * Both call styles are prepared: a held client's promise-style call and the pool's own callback-style one.
 */
export class PreparedStatements {
  /** On a statement config: prepare it on the connection that runs it. */
  static readonly MARK: unique symbol = Symbol('fromcode.db.prepare');
  static readonly PER_CONNECTION = 256;
  /** Postgres `feature_not_supported`, which "cached plan must not change result type" is raised as. */
  private static readonly RESULT_TYPE_CHANGED = '0A000';
  private static readonly connections = new WeakMap<object, { names: Set<string>; generation: number }>();

  /** `text` with its `values`, marked to be prepared. `extra` carries other config (`rowMode`). */
  static mark(text: string, values: unknown[] | undefined, extra: Record<string, unknown> = {}): Record<string | symbol, unknown> {
    return { ...extra, text, values, [PreparedStatements.MARK]: true };
  }

  /** Makes a new connection run marked statements as named ones. Called once per physical connection. */
  static install(client: { query: (...args: any[]) => any }): void {
    const query = client.query.bind(client);
    const state = { names: new Set<string>(), generation: 0 };
    PreparedStatements.connections.set(client, state);
    client.query = (...args: any[]) => {
      const config = args[0];
      if (!config || config !== Object(config) || !config[PreparedStatements.MARK]) return query(...args);
      const { [PreparedStatements.MARK]: _mark, ...plain } = config;
      const named = PreparedStatements.name(state, String(plain.text));
      if (!named) return query(plain, ...args.slice(1));
      const rest = args.slice(1);
      const callback = rest[rest.length - 1];
      const retry = () => {
        state.generation += 1;
        const renamed = PreparedStatements.name(state, String(plain.text));
        return renamed ? { ...plain, name: renamed } : plain;
      };
      // The pool's own path calls with a callback (pg-pool), a held client without one.
      if (callback instanceof Function) {
        return query({ ...plain, name: named }, ...rest.slice(0, -1), (error: any, result: unknown) => {
          if (error?.code !== PreparedStatements.RESULT_TYPE_CHANGED) return callback(error, result);
          return query(retry(), ...rest.slice(0, -1), callback);
        });
      }
      return Promise.resolve(query({ ...plain, name: named }, ...rest)).catch((error: any) => {
        if (error?.code !== PreparedStatements.RESULT_TYPE_CHANGED) throw error;
        return query(retry(), ...rest);
      });
    };
  }

  /** The name `text` runs under on this connection, or null once the connection holds its share. */
  private static name(state: { names: Set<string>; generation: number }, text: string): string | null {
    const name = `fc_${createHash('sha1').update(text).digest('hex').slice(0, 24)}_${state.generation}`;
    if (state.names.has(name)) return name;
    if (state.names.size >= PreparedStatements.PER_CONNECTION) return null;
    state.names.add(name);
    return name;
  }
}
