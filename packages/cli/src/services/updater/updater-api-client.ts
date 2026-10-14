import { InternalServiceAuth, RouteConstants } from '@fromcode119/core';
import type { IUpdaterHealth } from '@cli/services/updater/interfaces/updater-health.interface';
import type { IUpdaterStatus } from '@cli/services/updater/interfaces/updater-status.interface';

/**
 * The updater's line to the api, inside the deployment's own network: the plan, the reports, and the
 * health answer that proves a new version is the one serving.
 */
export class UpdaterApiClient implements IUpdaterHealth {
  private static readonly TIMEOUT_MS = 10_000;
  /** Long enough for an api to boot and run its migrations on a slow machine. */
  static readonly HEALTH_WAIT_MS = 6 * 60 * 1000;
  private static readonly HEALTH_INTERVAL_MS = 5000;

  constructor(
    private readonly apiBase: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async plan(): Promise<{ current: string; target: string; reason: string } | null> {
    const response = await this.call(RouteConstants.SEGMENTS.INTERNAL_UPDATER_PLAN, { headers: InternalServiceAuth.requestHeaders() });
    return response?.ok ? response.json() : null;
  }

  /** Whether the api stored it — it may be restarting, which is exactly when a final report matters. */
  async report(status: IUpdaterStatus): Promise<boolean> {
    const response = await this.call(RouteConstants.SEGMENTS.INTERNAL_UPDATER_STATUS, {
      method: 'POST',
      headers: { ...InternalServiceAuth.requestHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(status),
    });
    return Boolean(response?.ok);
  }

  /** A final report is retried until the api, back from its restart, has stored it. */
  async reportUntilStored(status: IUpdaterStatus, attempts = 30): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (await this.report(status)) return true;
      await this.sleep(UpdaterApiClient.HEALTH_INTERVAL_MS);
    }
    return false;
  }

  /** The api reports exactly `version` within the wait — the same test the deploy CLI uses. */
  async reports(version: string): Promise<boolean> {
    const bare = version.replace(/^v/, '');
    const deadline = Date.now() + UpdaterApiClient.HEALTH_WAIT_MS;
    while (Date.now() < deadline) {
      const response = await this.call('/health', {});
      const body = response?.ok ? await response.text().catch(() => '') : '';
      if (body.includes(`"version":"${bare}"`)) return true;
      await this.sleep(UpdaterApiClient.HEALTH_INTERVAL_MS);
    }
    return false;
  }

  /** An api that is restarting does not answer; that is `null`, never an exception the loop dies on. */
  private async call(route: string, init: RequestInit): Promise<Response | null> {
    try {
      return await this.fetchImpl(`${this.apiBase}${route}`, { ...init, signal: AbortSignal.timeout(UpdaterApiClient.TIMEOUT_MS) });
    } catch {
      return null;
    }
  }
}
