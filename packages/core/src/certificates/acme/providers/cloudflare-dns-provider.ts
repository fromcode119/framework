import { Resolver } from 'dns/promises';
import { CloudflareChallengeRecord } from '@core/certificates/acme/providers/cloudflare-challenge-record';

/**
 * Publishes and withdraws `_acme-challenge` TXT records through Cloudflare's API, for DNS-01.
 *
 * ADD, NEVER UPSERT. A wildcard order validates the apex and the wildcard as two separate
 * authorizations, and RFC 8555 gives both the identifier `fromcode.com` — so both publish a TXT
 * record at the SAME name, `_acme-challenge.fromcode.com`, with DIFFERENT values (one per
 * authorization's key authorization). Searching for an existing record by name and overwriting it
 * would make the second authorization's publish erase the first's, and a record belonging to
 * something else entirely — Traefik's own in-flight challenge on the same zone — would be
 * clobbered outright. So this always POSTs a new record and remembers exactly the id it created;
 * cleanup deletes THAT id and nothing found by name.
 *
 * PROPAGATION IS AWAITED before the challenge-create callback returns, by polling PUBLIC resolvers
 * (Cloudflare's own 1.1.1.1/1.0.0.1) rather than trusting the API's own "created" response —
 * Cloudflare's edge takes a little while to actually start answering the record, and the authority
 * validating the challenge asks the public internet, not this API.
 */
export class CloudflareDnsProvider {
  private static readonly API_BASE = 'https://api.cloudflare.com/client/v4';
  private static readonly REQUEST_TIMEOUT_MS = 15_000;
  /** Cloudflare's own public resolvers — asking anything else risks a stale, cached answer. */
  private static readonly PUBLIC_RESOLVERS: readonly string[] = ['1.1.1.1', '1.0.0.1'];
  private static readonly PROPAGATION_TIMEOUT_MS = 120_000;
  private static readonly PROPAGATION_POLL_MS = 5_000;

  constructor(
    private readonly apiToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
    /** Injected so propagation polling can be tested without the network or real resolvers. */
    private readonly resolverFactory: (server: string) => { resolveTxt(name: string): Promise<string[][]> } = CloudflareDnsProvider.systemResolver,
    private readonly sleepImpl: (ms: number) => Promise<void> = CloudflareDnsProvider.sleep,
  ) {}

  /**
   * Whether this token can see a zone by this name — OR THE ZONE IT LIVES UNDER — at all. Asked
   * before an order, never after, so a token with no access to the zone is caught before it spends
   * the authority's failure budget.
   */
  async canManageZone(hostname: string): Promise<boolean> {
    return (await this.resolveZoneId(hostname)) !== null;
  }

  /**
   * Publish `value` at `_acme-challenge.<recordName base>` and wait until it is visible on public
   * DNS. Returns the ids needed to remove exactly this record and nothing else.
   *
   * `zoneName` is the identifier RFC 8555 gave the authorization — usually the HOST, not the
   * Cloudflare zone that actually holds it (`admin.fromcode.com`'s zone is `fromcode.com`, not
   * itself), so the zone is RESOLVED here rather than looked up by an exact name match.
   *
   * If propagation never completes, the record already published must not survive this call: an
   * orphaned `_acme-challenge` TXT record left in the operator's zone forever is a worse outcome
   * than the failed order itself, so the failure path deletes what it just created before rethrowing.
   */
  async createChallengeRecord(zoneName: string, recordName: string, value: string): Promise<CloudflareChallengeRecord> {
    const zoneId = await this.resolveZoneId(zoneName);
    if (!zoneId) {
      throw new Error(`Cloudflare zone "${zoneName}" was not found, or this token cannot see it.`);
    }

    const recordId = await this.addTxtRecord(zoneId, recordName, value);
    try {
      await this.waitForPropagation(recordName, value);
    } catch (error) {
      await this.removeChallengeRecord(new CloudflareChallengeRecord(zoneId, recordId)).catch(() => undefined);
      throw error;
    }
    return new CloudflareChallengeRecord(zoneId, recordId);
  }

  /** Delete only the specific record id this provider created — never a lookup by name. */
  async removeChallengeRecord(record: CloudflareChallengeRecord): Promise<void> {
    await this.request(`/zones/${record.zoneId}/dns_records/${record.recordId}`, { method: 'DELETE' });
  }

  /**
   * The Cloudflare zone id that actually holds `hostname`, resolved by walking up its labels.
   *
   * Cloudflare's API matches a zone by its EXACT registered name — it does no public-suffix-list
   * resolution for you — so asking for `admin.fromcode.com` never finds the zone `fromcode.com`
   * that the token actually manages. This tries the hostname itself first (the apex/host case,
   * unchanged), then each parent label in turn, and stops at the first zone the token can see. The
   * bare TLD (the last single label) is never tried — a token that "manages" `com` is not a real case.
   */
  private async resolveZoneId(hostname: string): Promise<string | null> {
    const labels = hostname.split('.').filter((label) => label.length > 0);
    for (let start = 0; start < labels.length - 1; start += 1) {
      const candidate = labels.slice(start).join('.');
      const zoneId = await this.findZoneId(candidate);
      if (zoneId) return zoneId;
    }
    return null;
  }

  private async findZoneId(zoneName: string): Promise<string | null> {
    const body = await this.request(`/zones?name=${encodeURIComponent(zoneName)}`, { method: 'GET' });
    const zone = Array.isArray(body?.result) ? body.result[0] : null;
    return zone?.id ? String(zone.id) : null;
  }

  private async addTxtRecord(zoneId: string, name: string, value: string): Promise<string> {
    const body = await this.request(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ type: 'TXT', name, content: value, ttl: 120 }),
    });
    const id = body?.result?.id;
    if (!id) {
      throw new Error(`Cloudflare did not return a record id after creating the TXT challenge record for "${name}".`);
    }
    return String(id);
  }

  /**
   * Polls PUBLIC DNS until `value` is visible at `name`, or gives up.
   *
   * Every configured resolver must be tried on every round — a value present at one and not the
   * other is not yet safe to hand to the authority, which may itself ask through whichever of the
   * two it prefers.
   */
  private async waitForPropagation(name: string, value: string): Promise<void> {
    const deadline = Date.now() + CloudflareDnsProvider.PROPAGATION_TIMEOUT_MS;
    for (;;) {
      if (await this.isVisibleEverywhere(name, value)) return;
      if (Date.now() >= deadline) {
        throw new Error(`TXT record "${name}" did not become visible on public DNS within the timeout.`);
      }
      await this.sleepImpl(CloudflareDnsProvider.PROPAGATION_POLL_MS);
    }
  }

  private async isVisibleEverywhere(name: string, value: string): Promise<boolean> {
    for (const server of CloudflareDnsProvider.PUBLIC_RESOLVERS) {
      if (!(await this.isVisibleAt(server, name, value))) return false;
    }
    return true;
  }

  private async isVisibleAt(server: string, name: string, value: string): Promise<boolean> {
    try {
      const resolver = this.resolverFactory(server);
      const records = await resolver.resolveTxt(name);
      return records.map((parts) => parts.join('')).includes(value);
    } catch {
      // NXDOMAIN/ENODATA while the record has not propagated yet — not an error, just "not yet".
      return false;
    }
  }

  private async request(path: string, init: { method: string; body?: string }): Promise<any> {
    const response = await this.fetchImpl(`${CloudflareDnsProvider.API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(CloudflareDnsProvider.REQUEST_TIMEOUT_MS),
    } as RequestInit);

    const parsed = await response.json().catch(() => null) as any;
    if (!response.ok || parsed?.success === false) {
      const message = parsed?.errors?.[0]?.message || `Cloudflare API request failed (${response.status}).`;
      throw new Error(String(message));
    }
    return parsed;
  }

  private static systemResolver(server: string): { resolveTxt(name: string): Promise<string[][]> } {
    const resolver = new Resolver();
    resolver.setServers([server]);
    return resolver;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
  }
}
