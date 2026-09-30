import { createHash } from 'crypto';

/**
 * Signs the tenant bindings the api asks the database for, so SQL cannot forge them.
 *
 * Row-level security read the site from `app.tenant_id`, a session setting — and the application role
 * can set its own session settings. Any SQL the app role runs could therefore say
 * `SELECT set_config('app.tenant_id', '<another site>', false)` and read that site's rows: measured on
 * a local stack, a plain app-role connection went from 0 visible `people` rows to 183 of another
 * site's. Raw SQL is a plugin capability (`database:raw`), so the boundary between sites was one call
 * away from any plugin, or any injection into one.
 *
 * The binding is now recorded by the database itself, and changes only on a request signed with this
 * key over a per-connection nonce and counter, so no signature is ever accepted twice (see
 * TenantBindingSql). SQL can still set the old session settings; nothing reads them for access.
 *
 * THE KEY LIVES IN THE DATABASE, in a table only the owner role can read. It is generated there once and
 * read back by the api over its OWNER connection when the verifier is installed (the first step of every
 * boot), so it depends on no secret in the environment — a migration run by a CLI with no application
 * secrets works the same — and every replica signs with the one key the database verifies against. The
 * extension host, which reaches the database only through the api, never holds it.
 */
export class TenantBindingKey {
  private static key = '';

  /** Called with the key the database holds, once it has been read over the owner connection. */
  static use(key: string): void {
    TenantBindingKey.key = String(key || '');
  }

  /** Whether this process has the key yet. */
  static get loaded(): boolean {
    return TenantBindingKey.key.length > 0;
  }

  /**
   * The signature for `message` — `state:pid` to open, `state:pid:nonce:counter` to bind. Must match
   * TenantBindingSql. '' when this process has no key: the database then accepts the request only from
   * an OWNER connection, and refuses it from the application role.
   */
  static sign(message: string): string {
    const key = TenantBindingKey.key;
    if (!key) return '';
    const inner = createHash('sha256').update(key + message, 'utf8').digest('hex');
    return createHash('sha256').update(key + inner, 'utf8').digest('hex');
  }
}
