import type { ITenantPolicySpec } from '@fromcode119/database';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';

/**
 * The tenant policies that are NOT the generic one, in the one place that defines them.
 *
 * Three tables need a policy the generic `tenant_id = current_tenant` cannot express:
 *
 *   media                    — a shared asset is READABLE by every tenant and writable by none but
 *                              its owner, so it needs four per-command policies (WITH CHECK does not
 *                              govern DELETE, so a single policy would let a borrower delete another
 *                              customer's file).
 *   _system_meta             — a tenant may read the handful of deployment truths it cannot own.
 *   _system_plugin_settings  — per tenant, with the untenanted branch that keeps a deployment with
 *                              no tenants working.
 *
 * WHY THIS IS NOT LEFT IN THE MIGRATIONS THAT INTRODUCED IT: migrations run once. A deployment that
 * has no tenants has its policies REMOVED (see `SchemaManager.removeTenantIsolation`, which exists
 * because a policy with no tenant bound matches no row and empties the site). If it later gains a
 * tenant, the boot sweep re-applies the generic policies — but a migration that already ran will
 * never run again, so `media` and the two settings tables would come back UNPROTECTED, silently.
 * Defining them here and applying them from the sweep makes the transition self-healing in both
 * directions, and keeps one definition rather than two that can drift apart.
 *
 * WHAT, NOT HOW. This class used to build the policy statements itself, which put Postgres SQL —
 * and the tenant predicate — in core, outside the dialect that owns row-level security. It now
 * DECLARES what each policy means; the driver renders it. The knowledge stays where it belongs on
 * both sides: which keys are deployment truths is core's (`SystemSettingRegistry`), and how a policy
 * is written is Postgres'.
 */
export class TenantBespokePolicies {
  /**
   * Deployment truths a tenant cannot own — the only keys readable from the platform row.
   *
   * DERIVED, never hand-written. Scope used to be an OMISSION from an array here: a key nobody
   * remembered to add was per-site by default, so its write was filed under whichever tenant the
   * request carried while a platform read looked at the NULL row and found nothing. That shipped
   * three times (`admin_search_indexing`, `framework_repository`, `sources_workspace_root`) and was
   * invisible each time, because every one of them fails closed. `SystemSettingRegistry` declares
   * scope once per key, as a `Record` over `META_KEY`, so a key with no declared scope is a COMPILE
   * error rather than a silent site-scoped setting.
   */
  private static get PLATFORM_KEYS(): string[] {
    return SystemSettingRegistry.platformKeys();
  }

  /** The platform keys, for the code that must NOT hand them to a tenant — the tenant importer. */
  static platformKeys(): string[] {
    return [...TenantBespokePolicies.PLATFORM_KEYS];
  }

  /** Every table this class owns the policy for. The generic sweep must skip exactly these. */
  static tables(): string[] {
    return TenantBespokePolicies.specs().map((spec) => spec.table);
  }

  /**
   * What each bespoke policy MEANS, for the driver to render.
   *
   * The order is the order they are applied in, and it is not significant — each spec is
   * self-contained and idempotent.
   */
  static specs(): ITenantPolicySpec[] {
    return [
      // A shared asset is READABLE by every tenant and writable by none but its owner.
      { table: 'media', kind: 'shared-read', sharedColumn: 'shared' },
      // A tenant may read the handful of deployment truths it cannot own.
      {
        table: '_system_meta',
        kind: 'platform-keys-visible',
        keyColumn: 'key',
        platformKeys: TenantBespokePolicies.PLATFORM_KEYS,
      },
      // A plugin's configuration is never platform-level.
      { table: '_system_plugin_settings', kind: 'tenant-settings' },
      { table: '_system_audit_logs', kind: 'journal' },
      { table: '_system_logs', kind: 'journal' },
      // A version is a SNAPSHOT of a record's data. The rows were reachable by collection + id with an
      // `admin` guard and no tenant filter, so another site's content could be read back out of its
      // history even though the record itself is isolated.
      { table: '_system_record_versions', kind: 'journal' },
      // THE IN-APP INBOX, and a `journal` rather than a generic scoped table for a reason that cost
      // a rewrite: the generic predicate is strict equality, so a row whose `tenant_id` is NULL
      // matches in NO scope. `TenantAdoptionService` states the invariant — "one NULL row is a row
      // that becomes invisible to everyone" — and this table cannot satisfy it, because it is
      // written from BOTH sides. A plugin notifying a site's admins writes it inside that site; the
      // certificate-expiry sweep and the boot health reporter write it with no tenant bound at all.
      // Scoping it generically would therefore have hidden every notification ever written by the
      // untenanted half, on every existing deployment, silently.
      //
      // The journal predicate is exactly the rule wanted: a site sees its own, and rows written
      // untenanted belong to the platform scope, where the operator can still read them.
      //
      // What was wrong before: the table had no tenant column at all, so every row an account held
      // was shown in every scope it could enter. Measured here — one operator in four sites holding
      // 141 rows, among them "The TLS certificate for globex.framework.local expires in 1 day",
      // another customer's domain in the bell while standing inside a different site.
      { table: '_system_notifications', kind: 'journal' },
      // THE DO-NOT-EMAIL LIST, and the one table here where losing a row is the DANGEROUS direction.
      //
      // It was not merely readable across sites: `isSuppressed` matches on the ADDRESS alone, so one
      // site's bounce or unsubscribe silently stopped every OTHER site mailing that person.
      // Unsubscribing from one sender is not consent withdrawn from all of them.
      //
      // It is NOT generically scoped, because the generic predicate is strict equality and an
      // unowned row would then match in no scope at all — which for this table means quietly
      // resuming mail to someone who asked not to receive it. Production sends real email, and the
      // count of unowned rows there is not knowable from here, so the policy must be safe without
      // needing to know it. `unowned-read` is: a row nobody owns keeps applying everywhere, which is
      // the only honest reading of a suppression that predates per-site suppression, while each site
      // owns what it writes and no site can edit or delete another's — or an unowned one.
      { table: '_system_email_suppressions', kind: 'unowned-read' },
    ];
  }
}
