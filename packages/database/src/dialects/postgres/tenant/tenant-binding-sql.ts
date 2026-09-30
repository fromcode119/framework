import { SqlIdentifier } from '@database/dialects/postgres/sql-identifier';

/**
 * The database half of TenantBindingKey: which site a connection is bound to, recorded where no SQL the
 * application role runs can change it.
 *
 * `app.tenant_id` is a session setting, and the application role can set its own. Policies used to
 * read it raw, so `set_config('app.tenant_id', '<another site>', false)` from any raw query read that
 * site's rows, and clearing it read every tenant-less row — the platform's own settings among them.
 *
 * Now a connection's BINDING — `tenant:<id>`, `platform` or `none` — lives in a TEMPORARY table,
 * `pg_temp.fc_tenant_binding`, that belongs to the OWNER role: private to the connection, gone when the
 * connection ends (so a reused backend pid can never inherit it), and not writable by the application
 * role. It changes only through two SECURITY DEFINER functions, each demanding a signature made with
 * the key in `_system_tenant_binding_key` (owner-only), which the api derives and nothing in the
 * database can read:
 *
 * - `fc_binding_open(state, sig)` — the FIRST statement on a new connection (issued from the pool's
 *   `connect` event, so nothing can run before it). Signed over `state:pid`; refused once the
 *   connection has opened, so it cannot be replayed on a live one. Returns a fresh random nonce.
 * - `fc_bind(state, counter, sig)` — every later change. Signed over `state:pid:nonce:counter`, and
 *   accepted only for the NEXT counter, so a signature seen once can never be used again.
 *
 * `fc_bound_tenant()`, `fc_platform_admin()` and `fc_unbound()` answer the policies from that table
 * alone, and only when the OWNER created it — a same-named temp table the application role made for
 * itself counts for nothing. A connection with no binding sees no site's rows and none of the
 * platform's. The raw `app.tenant_id` / `app.platform_admin` settings are still written, by these
 * functions, for the column DEFAULTs; no policy reads them.
 *
 * All functions pin `search_path` to `pg_catalog` and name their tables with the schema, so no
 * caller-created object stands in for a builtin; a policy stores a function by OID when it is created,
 * so a caller's own `search_path` cannot swap one later either. The signature is
 * `sha256(key || sha256(key || message))`, hex — nested, so a known one cannot be extended into
 * another. It must match TenantBindingKey.sign exactly.
 */
export class TenantBindingSql {
  static readonly KEY_TABLE = '_system_tenant_binding_key';

  /** The verified site, or NULL. In a policy: evaluated once per statement, not per row. */
  static boundTenantExpression(): string {
    return '(SELECT fc_bound_tenant())';
  }

  /** The connection verifiably acts for the platform. */
  static platformAdminExpression(): string {
    return '(SELECT fc_platform_admin())';
  }

  /** The connection is verifiably bound to NO site — `none` or `platform` — so tenant-less rows are its to read. */
  static unboundExpression(): string {
    return '(SELECT fc_unbound())';
  }

  /** `$1` state, `$2` signature over `state:pid`. Returns the connection's nonce. */
  static openStatement(): string {
    return 'SELECT fc_binding_open($1, $2) AS nonce';
  }

  /** `$1` state, `$2` counter, `$3` signature over `state:pid:nonce:counter`. */
  static bindStatement(): string {
    return 'SELECT fc_bind($1, $2, $3)';
  }

  static currentSchemaStatement(): string {
    return 'SELECT current_schema() AS schema';
  }

  /** The binding state string the signatures cover — the ONE place node spells it. */
  static stateOf(binding: { tenantId?: string | null; platformAdmin?: boolean }): string {
    const tenant = String(binding.tenantId ?? '').trim();
    if (tenant) return `tenant:${tenant}`;
    return binding.platformAdmin ? 'platform' : 'none';
  }

  /** Everything, in order. `$1` of the key statement is the key. */
  static installStatements(schema: string): { before: string[]; key: string; after: string[] } {
    const s = SqlIdentifier.assert(schema, 'TenantBindingSql');
    const keys = `"${s}"."${TenantBindingSql.KEY_TABLE}"`;
    const sign = (message: string) =>
      `encode(sha256(convert_to(k.key || encode(sha256(convert_to(k.key || ${message}, 'UTF8')), 'hex'), 'UTF8')), 'hex')`;
    // The binding table exists, and the OWNER made it (current_user is the owner inside these
    // SECURITY DEFINER functions).
    const owned = `EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = to_regclass('pg_temp.fc_tenant_binding')
                     AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user))`;
    // Sets the RAW settings the column DEFAULTs read, to match the verified binding.
    const mirror = `PERFORM set_config('app.tenant_id', CASE WHEN p_state LIKE 'tenant:%' THEN substr(p_state, 8) ELSE '' END, false);
             PERFORM set_config('app.platform_admin', CASE WHEN p_state = 'platform' THEN 'on' ELSE 'off' END, false);`;
    return {
      before: [
        `CREATE TABLE IF NOT EXISTS ${keys} (id INT PRIMARY KEY CHECK (id = 1), key TEXT NOT NULL)`,
        `REVOKE ALL ON TABLE ${keys} FROM PUBLIC`,
        // Default privileges hand new tables to the application role; take every grant back.
        `DO $$ DECLARE r record; BEGIN
           FOR r IN SELECT DISTINCT grantee FROM information_schema.role_table_grants
                    WHERE table_schema = '${s}' AND table_name = '${TenantBindingSql.KEY_TABLE}' AND grantee <> current_user
           LOOP EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', '${s}', '${TenantBindingSql.KEY_TABLE}', r.grantee); END LOOP;
         END $$`,
      ],
      key: `INSERT INTO ${keys} (id, key) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key`,
      after: [
        `CREATE OR REPLACE FUNCTION "${s}".fc_binding_open(p_state text, p_sig text) RETURNS text
           LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $f$
           DECLARE v_nonce text;
           BEGIN
             IF to_regclass('pg_temp.fc_tenant_binding') IS NOT NULL THEN
               RAISE EXCEPTION 'tenant binding: this connection is already open';
             END IF;
             IF NOT EXISTS (SELECT 1 FROM ${keys} k WHERE k.id = 1
                             AND p_sig = ${sign(`p_state || ':' || pg_backend_pid()::text`)}) THEN
               RAISE EXCEPTION 'tenant binding: open refused';
             END IF;
             CREATE TEMPORARY TABLE fc_tenant_binding (nonce text NOT NULL, counter int NOT NULL, bound text NOT NULL);
             REVOKE ALL ON TABLE pg_temp.fc_tenant_binding FROM PUBLIC;
             v_nonce := gen_random_uuid()::text;
             INSERT INTO pg_temp.fc_tenant_binding (nonce, counter, bound) VALUES (v_nonce, 0, p_state);
             ${mirror}
             RETURN v_nonce;
           END $f$`,
        `CREATE OR REPLACE FUNCTION "${s}".fc_bind(p_state text, p_counter int, p_sig text) RETURNS void
           LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $f$
           BEGIN
             IF NOT ${owned} THEN
               RAISE EXCEPTION 'tenant binding: bind refused';
             END IF;
             UPDATE pg_temp.fc_tenant_binding b SET counter = p_counter, bound = p_state
               FROM ${keys} k
              WHERE k.id = 1 AND p_counter = b.counter + 1
                AND p_sig = ${sign(`p_state || ':' || pg_backend_pid()::text || ':' || b.nonce || ':' || p_counter::text`)};
             IF NOT FOUND THEN
               RAISE EXCEPTION 'tenant binding: bind refused';
             END IF;
             ${mirror}
           END $f$`,
        `CREATE OR REPLACE FUNCTION "${s}".fc_binding_state() RETURNS text
           LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $f$
           BEGIN
             IF NOT ${owned} THEN RETURN NULL; END IF;
             RETURN (SELECT b.bound FROM pg_temp.fc_tenant_binding b LIMIT 1);
           END $f$`,
        `CREATE OR REPLACE FUNCTION "${s}".fc_bound_tenant() RETURNS text
           LANGUAGE sql STABLE SET search_path = pg_catalog AS $f$
           SELECT CASE WHEN st LIKE 'tenant:%' THEN substr(st, 8) END FROM (SELECT "${s}".fc_binding_state() AS st) x
         $f$`,
        `CREATE OR REPLACE FUNCTION "${s}".fc_platform_admin() RETURNS boolean
           LANGUAGE sql STABLE SET search_path = pg_catalog AS $f$
           SELECT coalesce("${s}".fc_binding_state() = 'platform', false)
         $f$`,
        `CREATE OR REPLACE FUNCTION "${s}".fc_unbound() RETURNS boolean
           LANGUAGE sql STABLE SET search_path = pg_catalog AS $f$
           SELECT coalesce("${s}".fc_binding_state() IN ('none', 'platform'), false)
         $f$`,
      ],
    };
  }
}
