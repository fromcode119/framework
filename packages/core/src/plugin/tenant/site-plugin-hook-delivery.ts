import { Logger } from '@core/logging';
import { TenantPluginRuntimePolicy } from '@core/plugin/tenant/tenant-plugin-runtime-policy';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';

/**
 * How an event reaches a SITE's plugin.
 *
 * A hook is two things at once: news that something happened, and — when the platform `call`s it —
 * a chance for every listener to replace the payload before the platform carries on. For a site's
 * plugin, only its OWN events keep the second half. Anyone else's (an order about to be saved, a page
 * about to render, a user signing in) it HEARS, and no more:
 *
 *  - Its answer is discarded. A plugin written to skim could otherwise set every order's total to 0,
 *    swap a payment account, or rewrite the site's pages on the way out.
 *  - It is not waited for. A slow or throwing listener would otherwise hold up — or fail — the
 *    platform's own sign-in, checkout or save for that site.
 *  - It hears a copy with every credential-shaped value replaced (`[redacted]`): passwords, tokens,
 *    keys, session ids, hashes. What happened is the news; the secrets in it are not.
 *
 * A platform-installed plugin is untouched: its listeners are awaited and their answers kept.
 */
export class SitePluginHookDelivery {
  static readonly REDACTED = '[redacted]';
  private static readonly logger = new Logger({ namespace: 'plugin-tenancy' });
  private static readonly SECRET_KEY = /pass(word|wd|phrase|code)|secret|token|api[-_]?key|otp|cvc|cvv|credential|authori[sz]ation|cookie|session[-_]?id|hash|salt|private[-_]?key|signature/i;
  private static readonly MAX_DEPTH = 32;

  /**
   * Hands `payload` to the plugin's handler via `invoke`. For a site's plugin hearing someone else's
   * event the result is `undefined` at once — the payload the platform `call`ed with stands.
   */
  static deliver(slug: string, event: string, payload: unknown, invoke: (payload: unknown) => Promise<unknown>): unknown {
    if (!PluginOwners.ownerOf(slug) || TenantPluginRuntimePolicy.isOwnEvent(slug, event)) return invoke(payload);
    invoke(SitePluginHookDelivery.redact(payload)).catch((error: unknown) => {
      SitePluginHookDelivery.logger.warn(`Site plugin "${slug}" failed handling "${event}": ${error instanceof Error ? error.message : String(error)}`);
    });
    return undefined;
  }

  /** A deep copy of `value` with every credential-shaped key's value replaced. The original is never touched. */
  static redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (depth >= SitePluginHookDelivery.MAX_DEPTH || seen.has(value)) return undefined;
    // Only the CURRENT path counts as a cycle: the same address object under two keys is copied twice.
    seen.add(value);
    let copy: unknown;
    if (Array.isArray(value)) {
      copy = value.map((item) => SitePluginHookDelivery.redact(item, depth + 1, seen));
    } else {
      const record: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        record[key] = SitePluginHookDelivery.SECRET_KEY.test(key) && item !== null && item !== undefined && item !== ''
          ? SitePluginHookDelivery.REDACTED
          : SitePluginHookDelivery.redact(item, depth + 1, seen);
      }
      copy = record;
    }
    seen.delete(value);
    return copy;
  }
}
