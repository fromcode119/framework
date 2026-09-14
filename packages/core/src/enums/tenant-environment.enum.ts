import { Enum } from '@fromcode119/react-class-components';

/**
 * Whether a site may act on the OUTSIDE WORLD — a third axis, independent of `state` and `visibility`.
 *
 * The three answer different questions and none implies another:
 *   state       — may this site be served and worked at all (suspension outranks everything)
 *   visibility  — who may READ this site
 *   environment — may this site SEND: email, payments, shipments, scheduled work
 *
 * All four combinations are real. A launched shop is public + production. A copy of a live shop taken
 * for testing is private + NON-production — it holds real customers, real Stripe keys and real courier
 * credentials, and must not reach any of them. A client's pre-launch site is private + PRODUCTION,
 * because "send me a test order confirmation" has to actually arrive. Inferring either field from the
 * other would break one of those.
 *
 * The brake lives at the framework's own chokepoints, not in the plugins: a plugin that has never
 * heard of this enum still cannot send. It is enforced on the email driver, on `context.fetch` (the
 * only egress a sandboxed plugin has) and on the scheduler's per-tenant iteration.
 *
 * INERT WITHOUT TENANCY. Platform-level work (certificate mail, telemetry) runs with no tenant in the
 * request store, and a single-tenant deployment has no tenant either; the gate allows both. There is
 * nothing to flag when there is no site.
 *
 * Compare against `.value` — the column holds a raw string, and an Enum tested against a string is
 * always false.
 */
export class TenantEnvironment extends Enum {
  /**
   * The real thing. Email leaves, payments capture, shipments book, scheduled work runs.
   *
   * The default for every existing and new site: a site that was live before this field existed must
   * keep sending, and a field nobody set must not silently mute a working shop.
   */
  static readonly PRODUCTION = new TenantEnvironment('production');

  /**
   * A copy, a rehearsal, a sandbox. Nothing reaches the outside world.
   *
   * Refusals are LOUD — every blocked effect throws and is audited. Never a silent success: a staging
   * checkout that appears to charge a card and did not is worse than one that visibly refuses.
   */
  static readonly NON_PRODUCTION = new TenantEnvironment('non-production');

  private constructor(value: string) {
    super(value);
  }

  /**
   * The member a stored or wire value names, or null when it names none.
   *
   * `find`, never a defaulting `resolve`: an unreadable value must not fall through to PRODUCTION and
   * quietly hand a sandbox the ability to email real customers.
   */
  static find(value: unknown): TenantEnvironment | null {
    if (value instanceof TenantEnvironment) return value;
    return (TenantEnvironment.fromValue(String(value ?? '').trim().toLowerCase()) as TenantEnvironment | undefined) ?? null;
  }

  /** What an operator may choose, for the form that asks. */
  static definitions(): Array<{ label: string; value: string; description: string }> {
    return [
      {
        value: String(TenantEnvironment.PRODUCTION.value),
        label: 'Production',
        description: 'The real site. Email, payments, shipments and scheduled work all reach the outside world.',
      },
      {
        value: String(TenantEnvironment.NON_PRODUCTION.value),
        label: 'Non-production',
        description: 'A copy for testing. No email, payment, shipment or scheduled job can leave this site, whatever its plugins are configured to do.',
      },
    ];
  }

  /** Whether this site may reach the outside world. */
  get isProduction(): boolean {
    return this === TenantEnvironment.PRODUCTION;
  }
}
