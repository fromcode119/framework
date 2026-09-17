/**
 * A policy the generic `tenant_id = current_tenant` rule cannot express.
 *
 * The CALLER declares WHAT the rule means — "media may be shared", "these settings keys are
 * deployment truths", "this table is a journal" — and the dialect renders HOW. That split is the
 * whole point: the keys and table names are core knowledge (`SystemSettingRegistry`,
 * `SystemConstants`), while `CREATE POLICY ... USING ... WITH CHECK` is Postgres knowledge. Neither
 * side has to know the other's half.
 */
export type ITenantPolicySpec =
  /**
   * An asset may be marked shared: READABLE by every tenant, writable by none but its owner.
   * Renders four per-command policies, because `WITH CHECK` does not govern DELETE — a single
   * `USING (own OR shared)` would let a borrower delete another customer's file.
   */
  | { table: string; kind: 'shared-read'; sharedColumn: string }
  /**
   * A tenant may read the handful of deployment truths it cannot own, and nothing else, so one key
   * never resolves to two visible rows.
   */
  | { table: string; kind: 'platform-keys-visible'; keyColumn: string; platformKeys: string[] }
  /**
   * A tenant's own record of what happened on its site. A PLATFORM admin reads every site's (an
   * operator investigating an incident cannot enter each site in turn); an UNTENANTED connection may
   * WRITE with no marker, because boot and migrations log before any tenant is bound.
   */
  | { table: string; kind: 'journal' }
  /**
   * Per tenant with no shared keys, plus the untenanted branch that keeps a deployment with no
   * tenants working. A plugin's configuration is never platform-level.
   */
  | { table: string; kind: 'tenant-settings' }
  /**
   * A tenant's own rows, PLUS the ones nobody owns — readable by every tenant, writable only by the
   * tenant that owns them, and an unowned row writable by nobody.
   *
   * For a table where losing a row is the DANGEROUS direction, so the generic predicate's strict
   * equality (an unowned row matches in no scope at all) cannot be used. The do-not-email list is
   * the case: an unowned suppression predates per-site suppression, and the only safe reading of it
   * is "this person opted out, and no site has established otherwise". Making it invisible would
   * silently resume mailing someone who asked not to be mailed.
   *
   * Four per-command policies for the same reason as `shared-read`: `WITH CHECK` does not govern
   * DELETE, so a single `USING (own OR unowned)` would let any tenant delete the unowned rows.
   */
  | { table: string; kind: 'unowned-read' };
