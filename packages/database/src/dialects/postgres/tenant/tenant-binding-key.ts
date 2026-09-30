import { createHash } from 'crypto';

/**
 * Signs the tenancy markers a connection carries, so SQL cannot forge them.
 *
 * Row-level security reads the site from `app.tenant_id`, a session setting — and the application role
 * can set its own session settings. Any SQL the app role runs could therefore say
 * `SELECT set_config('app.tenant_id', '<another site>', false)` and read that site's rows: measured on
 * a local stack, a plain app-role connection went from 0 visible `people` rows to 183 of another
 * site's. Raw SQL is a plugin capability (`database:raw`), so the boundary between sites was one call
 * away from any plugin, or any injection into one.
 *
 * The binding is now recorded by the database itself, and changes only on a request signed with this
 * key — which the database holds in a table the application role cannot read — over a per-connection
 * nonce and counter, so no signature is ever accepted twice (see TenantBindingSql). SQL can still set
 * the old session settings; nothing reads them for access any more.
 *
 * The key is derived from `JWT_SECRET` — every api process has it, the extension host (which reaches
 * the database only through the api) does not — under a label of its own, so it is never the token
 * key itself.
 */
export class TenantBindingKey {
  private static readonly LABEL = 'fromcode.tenant-binding';

  /** The key, or '' when this process has no secret to derive it from — which signs nothing. */
  static value(): string {
    const secret = String(process.env.JWT_SECRET || '');
    if (!secret) return '';
    return createHash('sha256').update(`${TenantBindingKey.LABEL}\u0000${secret}`).digest('hex');
  }

  /** The signature for `message` — `state:pid` to open, `state:pid:nonce:counter` to bind. Must match TenantBindingSql. */
  static sign(message: string): string {
    const key = TenantBindingKey.value();
    if (!key) {
      throw new Error('TenantBindingKey: JWT_SECRET is not set, so tenancy bindings cannot be signed; refusing to bind.');
    }
    const inner = createHash('sha256').update(key + message, 'utf8').digest('hex');
    return createHash('sha256').update(key + inner, 'utf8').digest('hex');
  }
}
