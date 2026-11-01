import type { IMonitoringProvider } from '@core/monitoring/interfaces/monitoring-provider.interface';
import type { IMonitoringTarget } from '@core/monitoring/interfaces/monitoring-target.interface';

/**
 * UptimeRobot watches the platform's addresses from outside and alerts through its own alert contacts —
 * which is what still works when the whole server is down.
 *
 * Only monitors whose name starts with the configured prefix are the platform's: those are added and
 * removed to match the site list, and every other monitor in the account is left alone.
 *
 * Each of the platform's monitors is given EVERY active alert contact in the account. UptimeRobot alerts
 * only the contacts a monitor names, and a monitor created through the API names none — so until
 * 2026-11-01 every monitor here watched, saw the platform go down, and told nobody. A monitor that is
 * missing a contact gets it on the next sync.
 *
 * Speaks the v3 API. v2 still reads, but refuses every `newMonitor` on current accounts — whatever the
 * settings — with "You are not allowed to use some settings with your current plan", while v3 creates the
 * same monitor with the same key.
 */
export class UptimeRobotMonitoringProvider implements IMonitoringProvider {
  private static readonly API = 'https://api.uptimerobot.com/v3';
  private static readonly PAGE_SIZE = 200;
  /** The free plan allows 10 requests a minute; one refused for that is retried once after this long. */
  private static readonly RATE_LIMIT_WAIT_MS = 61_000;

  /**
   * `interval` and `timeout` are the operator's "Check every" and "Wait for an answer" (seconds); 0 (not set)
   * sends none and leaves it to UptimeRobot.
   */
  constructor(private readonly apiKey: string, private readonly namePrefix: string, private readonly interval = 0, private readonly timeout = 0) {}

  async syncTargets(targets: IMonitoringTarget[]): Promise<void> {
    const existing = await this.ownMonitors();
    const contacts = await this.alertContacts();
    const assigned = contacts.map((alertContactId) => ({ alertContactId, threshold: 0, recurrence: 0 }));
    const wanted = new Map(targets.map((target) => [target.url, target]));
    for (const monitor of existing) {
      if (!wanted.has(monitor.url)) await this.call('DELETE', `/monitors/${encodeURIComponent(String(monitor.id))}`);
    }
    for (const monitor of existing) {
      if (!wanted.has(monitor.url)) continue;
      const has = new Set((monitor.assignedAlertContacts ?? []).map((contact) => Number(contact.alertContactId)));
      if (contacts.every((id) => has.has(id))) continue;
      await this.call('PATCH', `/monitors/${encodeURIComponent(String(monitor.id))}`, { assignedAlertContacts: assigned });
    }
    const present = new Set(existing.map((monitor) => monitor.url));
    for (const target of targets) {
      if (present.has(target.url)) continue;
      const timing = { ...(this.interval > 0 ? { interval: this.interval } : {}), ...(this.timeout > 0 ? { timeout: this.timeout } : {}) };
      await this.call('POST', '/monitors', { type: 'HTTP', url: target.url, friendlyName: `${this.namePrefix}${target.label}`, ...timing, ...(assigned.length ? { assignedAlertContacts: assigned } : {}) });
    }
  }

  /** Every active alert contact in the account: whoever the operator set up in UptimeRobot to be told. */
  private async alertContacts(): Promise<number[]> {
    const payload = await this.call('GET', '/user/alert-contacts');
    const rows: Array<{ id?: unknown; status?: unknown }> = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    return rows.filter((row) => String(row.status ?? '') === 'Active').map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  }

  private async ownMonitors(): Promise<Array<{ id: number; url: string; assignedAlertContacts?: Array<{ alertContactId: unknown }> }>> {
    const monitors: Array<{ id: number; url: string; friendlyName?: string; assignedAlertContacts?: Array<{ alertContactId: unknown }> }> = [];
    let next: string | null = `${UptimeRobotMonitoringProvider.API}/monitors?limit=${UptimeRobotMonitoringProvider.PAGE_SIZE}`;
    while (next) {
      const page = await this.call('GET', next);
      monitors.push(...(Array.isArray(page?.data) ? page.data : []));
      next = UptimeRobotMonitoringProvider.nextPage(page?.nextLink);
    }
    return monitors.filter((monitor) => String(monitor.friendlyName ?? '').startsWith(this.namePrefix));
  }

  /** The cursor UptimeRobot hands back — followed only on its own host, since the key goes with it. */
  private static nextPage(link: unknown): string | null {
    if (!link) return null;
    const url = new URL(String(link), UptimeRobotMonitoringProvider.API);
    return url.origin === new URL(UptimeRobotMonitoringProvider.API).origin ? url.toString() : null;
  }

  private async call(method: string, path: string, body?: Record<string, unknown>, retried = false): Promise<any> {
    const url = path.startsWith('http') ? path : `${UptimeRobotMonitoringProvider.API}${path}`;
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 429 && !retried) {
      await new Promise((resolve) => setTimeout(resolve, UptimeRobotMonitoringProvider.RATE_LIMIT_WAIT_MS));
      return this.call(method, path, body, true);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`UptimeRobot ${method} ${path.replace(UptimeRobotMonitoringProvider.API, '')} failed: ${payload?.message ?? payload?.error ?? response.status}`);
    }
    return payload;
  }
}
