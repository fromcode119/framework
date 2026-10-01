import type { IMonitoringProvider } from '@core/monitoring/interfaces/monitoring-provider.interface';
import type { IMonitoringTarget } from '@core/monitoring/interfaces/monitoring-target.interface';

/**
 * UptimeRobot watches the platform's addresses from outside and alerts through its own alert contacts —
 * which is what still works when the whole server is down.
 *
 * Only monitors whose name starts with the configured prefix are the platform's: those are added and
 * removed to match the site list, and every other monitor in the account is left alone.
 *
 * Speaks the v3 API. v2 still reads, but refuses every `newMonitor` on current accounts — whatever the
 * settings — with "You are not allowed to use some settings with your current plan", while v3 creates the
 * same monitor with the same key.
 */
export class UptimeRobotMonitoringProvider implements IMonitoringProvider {
  private static readonly API = 'https://api.uptimerobot.com/v3';
  private static readonly PAGE_SIZE = 200;

  /** `interval` is the operator's "Check every (seconds)"; 0 (not set) sends none and leaves it to UptimeRobot. */
  constructor(private readonly apiKey: string, private readonly namePrefix: string, private readonly interval = 0) {}

  async syncTargets(targets: IMonitoringTarget[]): Promise<void> {
    const existing = await this.ownMonitors();
    const wanted = new Map(targets.map((target) => [target.url, target]));
    for (const monitor of existing) {
      if (!wanted.has(monitor.url)) await this.call('DELETE', `/monitors/${encodeURIComponent(String(monitor.id))}`);
    }
    const present = new Set(existing.map((monitor) => monitor.url));
    for (const target of targets) {
      if (present.has(target.url)) continue;
      const interval = this.interval > 0 ? { interval: this.interval } : {};
      await this.call('POST', '/monitors', { type: 'HTTP', url: target.url, friendlyName: `${this.namePrefix}${target.label}`, ...interval });
    }
  }

  private async ownMonitors(): Promise<Array<{ id: number; url: string }>> {
    const monitors: Array<{ id: number; url: string; friendlyName?: string }> = [];
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

  private async call(method: string, path: string, body?: Record<string, unknown>): Promise<any> {
    const url = path.startsWith('http') ? path : `${UptimeRobotMonitoringProvider.API}${path}`;
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`UptimeRobot ${method} ${path.replace(UptimeRobotMonitoringProvider.API, '')} failed: ${payload?.message ?? payload?.error ?? response.status}`);
    }
    return payload;
  }
}
