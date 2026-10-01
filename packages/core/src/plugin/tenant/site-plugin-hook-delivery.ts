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
 *  - It hears a copy with every credential and every piece of personal data replaced (`[redacted]`):
 *    passwords, tokens, keys, session ids, hashes — and emails, phone numbers, names, street addresses,
 *    postcodes, dates of birth, IP addresses, tax and bank numbers. What happened is the news; who it
 *    happened to is not. A plugin that keeps what it hears and serves it back on its own route would
 *    otherwise be a mailing list of the site's customers.
 *
 * A platform-installed plugin is untouched: its listeners are awaited and their answers kept.
 */
export class SitePluginHookDelivery {
  static readonly REDACTED = '[redacted]';
  private static readonly logger = new Logger({ namespace: 'plugin-tenancy' });
  private static readonly SECRET_KEY = /pass(word|wd|phrase|code)|secret|token|api[-_]?key|otp|cvc|cvv|credential|authori[sz]ation|cookie|session[-_]?id|hash|salt|private[-_]?key|signature/i;
  /** Personal data by key, wherever it sits: `email`, `billingPhone`, `shippingAddress`, `lastName` … */
  private static readonly PERSONAL_KEY = /e-?mail|phone|mobile|^tel$|telephone|fax|(first|last|middle|full|given|family|sur|display|user|nick)[-_]?name|address|street|line[-_]?[12]|post(al)?[-_]?code|zip|birth|^dob$|^ip$|ip[-_]?address|user[-_]?agent|iban|bic|swift|account[-_]?number|tax[-_]?(id|number)|vat[-_]?(id|number)|national[-_]?id|personal[-_]?id|passport|egn|ssn|geo|latitude|longitude/i;
  /** A container that describes a PERSON: under it, a plain `name` is that person's name. */
  private static readonly PERSON_CONTAINER = /customer|user|billing|shipping|recipient|sender|author|contact|profile|person|member|buyer|client|guest|owner|actor|subscriber|attendee|patient|employee|staff/i;
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

  private static isRedacted(key: string, inPerson: boolean): boolean {
    return SitePluginHookDelivery.SECRET_KEY.test(key)
      || SitePluginHookDelivery.PERSONAL_KEY.test(key)
      || (inPerson && /^name$/i.test(key));
  }

  /** A deep copy of `value` with every credential- or personal-data-shaped key's value replaced. The original is never touched. */
  static redact(value: unknown, depth = 0, seen = new WeakSet<object>(), inPerson = false): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (depth >= SitePluginHookDelivery.MAX_DEPTH || seen.has(value)) return undefined;
    // Only the CURRENT path counts as a cycle: the same address object under two keys is copied twice.
    seen.add(value);
    let copy: unknown;
    if (Array.isArray(value)) {
      copy = value.map((item) => SitePluginHookDelivery.redact(item, depth + 1, seen, inPerson));
    } else {
      const record: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        record[key] = SitePluginHookDelivery.isRedacted(key, inPerson) && item !== null && item !== undefined && item !== ''
          ? SitePluginHookDelivery.REDACTED
          : SitePluginHookDelivery.redact(item, depth + 1, seen, inPerson || SitePluginHookDelivery.PERSON_CONTAINER.test(key));
      }
      copy = record;
    }
    seen.delete(value);
    return copy;
  }
}
