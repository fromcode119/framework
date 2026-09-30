import { TenantBindingSql } from '@database/dialects/postgres/tenant/tenant-binding-sql';
import { TenantBindingKey } from '@database/dialects/postgres/tenant/tenant-binding-key';
import type { ITenantSessionBinding } from '@database/dialects/postgres/tenant/interfaces/tenant-session-binding.interface';
import type { IPostgresQueryable } from '@database/dialects/postgres/tenant/interfaces/postgres-queryable.interface';
import type { IOpenedBinding } from '@database/dialects/postgres/tenant/interfaces/opened-binding.interface';

/**
 * Binds and clears the tenancy of ONE pooled client.
 *
 * The database records each connection's binding — a site, the platform, or none — and changes it only
 * on a signed request (TenantBindingSql): `fc_binding_open` once, as the connection's first statement,
 * then `fc_bind` with the next counter each time. SQL that sets `app.tenant_id` itself, clears it, or
 * replays a signature it saw gets no site and no platform rows at all.
 *
 * Session-scoped, not `SET LOCAL`: the binding survives across statements on a held client rather than
 * expiring with a transaction.
 *
 * Separate from `ITenantIsolation` because it is not a capability a caller outside this package ever
 * reaches for: it takes a raw `pg` client, and the only things holding one are the connection scope,
 * the one-shot client and the pool's own connect handler — all of which live beside this file.
 */
export class PostgresTenantSession {
  private static readonly opened = new WeakMap<object, IOpenedBinding>();

  /** Sets the binding the caller asks for. A binding with neither a site nor the platform is `none`. */
  static async bind(client: IPostgresQueryable, binding: ITenantSessionBinding): Promise<void> {
    await PostgresTenantSession.write(client, TenantBindingSql.stateOf(binding));
  }

  /**
   * Clears the binding — then restores the pool's RESTING state: `none` for a request pool, `platform`
   * for the DDL pool.
   *
   * The platform binding must never outlive the request that earned it, and a client goes back to a
   * shared pool. `platformPool` is what stops that rule breaking the DDL pool: every client IT hands out
   * acts for the platform, and `connect` fires once per physical connection, so a client that had been
   * through a scope must come back as the platform's, or every later untenanted platform write on it is
   * refused ("new row violates row-level security policy for _system_meta").
   */
  static async clear(client: IPostgresQueryable, platformPool = false): Promise<void> {
    await PostgresTenantSession.write(client, TenantBindingSql.stateOf({ platformAdmin: platformPool }));
  }

  /**
   * Opens a NEW physical connection in its resting state, from the pool's `connect` event.
   *
   * Issued SYNCHRONOUSLY: `pg` runs a client's queries in the order they were issued, so this is the
   * connection's first statement and nothing the borrower sends can run ahead of it. A failure is not
   * thrown into the pool — the connection then has no binding, and sees nothing.
   */
  static markResting(client: IPostgresQueryable, platformPool: boolean): void {
    const pid = PostgresTenantSession.knownPid(client);
    if (!pid) return;
    try {
      PostgresTenantSession.open(client, pid, TenantBindingSql.stateOf({ platformAdmin: platformPool }))
        .nonce.catch(() => undefined);
    } catch {
      // Nothing may throw out of a pool event.
      // The connection stays unbound and, under the tenant policies, sees nothing.
    }
  }

  private static async write(client: IPostgresQueryable, state: string): Promise<void> {
    const pid = PostgresTenantSession.knownPid(client) ?? await PostgresTenantSession.askPid(client);
    const existing = PostgresTenantSession.opened.get(client);
    if (!existing) {
      // Never opened (a client from a pool without the connect handler): opening IS this binding.
      await PostgresTenantSession.open(client, pid, state).nonce;
      return;
    }
    const nonce = await existing.nonce;
    existing.counter += 1;
    const counter = existing.counter;
    await client.query(TenantBindingSql.bindStatement(), [state, counter, TenantBindingKey.sign(`${state}:${pid}:${nonce}:${counter}`)]);
  }

  private static open(client: IPostgresQueryable, pid: number, state: string): IOpenedBinding {
    const nonce = client.query(TenantBindingSql.openStatement(), [state, TenantBindingKey.sign(`${state}:${pid}`)])
      .then((result) => String((result as { rows?: Array<{ nonce?: unknown }> })?.rows?.[0]?.nonce ?? ''));
    const entry: IOpenedBinding = { nonce, counter: 0 };
    PostgresTenantSession.opened.set(client, entry);
    // A refused open leaves no entry, so the next bind tries to open again rather than signing
    // against a nonce that does not exist.
    nonce.catch(() => { if (PostgresTenantSession.opened.get(client) === entry) PostgresTenantSession.opened.delete(client); });
    return entry;
  }

  /** The backend pid `pg` learned when it connected, or null. */
  private static knownPid(client: IPostgresQueryable): number | null {
    const known = Number((client as { processID?: unknown }).processID);
    return Number.isInteger(known) && known > 0 ? known : null;
  }

  private static async askPid(client: IPostgresQueryable): Promise<number> {
    const result = (await client.query('SELECT pg_backend_pid() AS pid')) as { rows?: Array<{ pid?: unknown }> };
    return Number(result?.rows?.[0]?.pid);
  }
}
