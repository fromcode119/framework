import type { IMonitoringProvider } from '@core/monitoring/interfaces/monitoring-provider.interface';
import type { IMonitoringTarget } from '@core/monitoring/interfaces/monitoring-target.interface';

/**
 * UptimeRobot watches the platform's addresses from outside and alerts through its own alert contacts —
 * which is what still works when the whole server is down.
 *
 * Only monitors whose name starts with the configured prefix are the platform's: those are added and
 * removed to match the site list, and every other monitor in the account is left alone.
 */
export class UptimeRobotMonitoringProvider implements IMonitoringProvider {
  private static readonly API = 'https://api.uptimerobot.com/v2';
  private static readonly HTTP_MONITOR = '1';

  /** `interval` is the operator's "Check every (seconds)"; 0 (not set) sends none and leaves it to UptimeRobot. */
  constructor(private readonly apiKey: string, private readonly namePrefix: string, private readonly interval = 0) {}

  async syncTargets(targets: IMonitoringTarget[]): Promise<void> {
    const existing = await this.ownMonitors();
    const wanted = new Map(targets.map((target) => [target.url, target]));
    for (const monitor of existing) {
      if (!wanted.has(monitor.url)) await this.call('deleteMonitor', { id: String(monitor.id) });
    }
    const present = new Set(existing.map((monitor) => monitor.url));
    for (const target of targets) {
      if (present.has(target.url)) continue;
      const interval = this.interval > 0 ? { interval: String(this.interval) } : {};
      await this.call('newMonitor', { type: UptimeRobotMonitoringProvider.HTTP_MONITOR, url: target.url, friendly_name: `${this.namePrefix}${target.label}`, ...interval });
    }
  }

  private async ownMonitors(): Promise<Array<{ id: number; url: string }>> {
    const monitors: Array<{ id: number; url: string; friendly_name: string }> = [];
    for (let offset = 0; ; offset += 50) {
      const page = await this.call('getMonitors', { offset: String(offset), limit: '50' });
      const batch = Array.isArray(page?.monitors) ? page.monitors : [];
      monitors.push(...batch);
      if (batch.length < 50) break;
    }
    return monitors.filter((monitor) => String(monitor.friendly_name ?? '').startsWith(this.namePrefix));
  }

  private async call(method: string, params: Record<string, string>): Promise<any> {
    const response = await fetch(`${UptimeRobotMonitoringProvider.API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: new URLSearchParams({ api_key: this.apiKey, format: 'json', ...params }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.stat !== 'ok') {
      throw new Error(`UptimeRobot ${method} failed: ${body?.error?.message ?? response.status}`);
    }
    return body;
  }
}
