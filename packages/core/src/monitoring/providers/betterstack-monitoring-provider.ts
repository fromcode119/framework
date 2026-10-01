import type { IMonitoringProvider } from '@core/monitoring/interfaces/monitoring-provider.interface';
import type { IMonitoringTarget } from '@core/monitoring/interfaces/monitoring-target.interface';

/**
 * Better Stack Uptime watches the platform's addresses from outside and alerts through its own on-call
 * settings — which is what still works when the whole server is down.
 *
 * Only monitors whose name starts with the configured prefix are the platform's: those are added and
 * removed to match the site list, and every other monitor in the account is left alone.
 */
export class BetterStackMonitoringProvider implements IMonitoringProvider {
  private static readonly API = 'https://uptime.betterstack.com/api/v2/monitors';

  constructor(private readonly apiToken: string, private readonly namePrefix: string) {}

  async syncTargets(targets: IMonitoringTarget[]): Promise<void> {
    const existing = await this.ownMonitors();
    const wanted = new Set(targets.map((target) => target.url));
    for (const monitor of existing) {
      if (!wanted.has(monitor.url)) await this.request(`${BetterStackMonitoringProvider.API}/${monitor.id}`, 'DELETE');
    }
    const present = new Set(existing.map((monitor) => monitor.url));
    for (const target of targets) {
      if (present.has(target.url)) continue;
      await this.request(BetterStackMonitoringProvider.API, 'POST', {
        monitor_type: 'status',
        url: target.url,
        pronounceable_name: `${this.namePrefix}${target.label}`,
      });
    }
  }

  private async ownMonitors(): Promise<Array<{ id: string; url: string }>> {
    const monitors: Array<{ id: string; url: string }> = [];
    let next: string | null = BetterStackMonitoringProvider.API;
    while (next) {
      const page: any = await this.request(next, 'GET');
      for (const entry of Array.isArray(page?.data) ? page.data : []) {
        if (String(entry?.attributes?.pronounceable_name ?? '').startsWith(this.namePrefix)) {
          monitors.push({ id: String(entry.id), url: String(entry.attributes.url ?? '') });
        }
      }
      next = page?.pagination?.next ?? null;
    }
    return monitors;
  }

  private async request(url: string, method: string, body?: Record<string, unknown>): Promise<any> {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Better Stack ${method} ${url} failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
}
