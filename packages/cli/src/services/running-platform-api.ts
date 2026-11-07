import { ApiPathUtils, EnvUtils } from '@fromcode119/core';
import { ReleaseHealthProbe } from '@cli/services/deploy/release-health-probe';

/**
 * The RUNNING platform, called the way its admin calls it.
 *
 * A plugin installed or updated from a terminal has to land exactly as one installed from the admin:
 * verified, recorded for every site, swapped into the live process with no restart, and told to every
 * other api process. Only the running api can do that — a second process writing the plugin folder
 * replaces files under a live plugin and leaves the running copy holding the old one. So the terminal
 * does not install anything itself: it asks the running api, through the same endpoints the admin uses.
 *
 * Authenticated by an API token of a platform admin (`FROMCODE_API_KEY`), never a password, and read
 * from the environment so it never appears in the process list.
 */
export class RunningPlatformApi {
  static readonly KEY_ENV = 'FROMCODE_API_KEY';
  static readonly URL_ENV = 'FROMCODE_API_URL';

  private constructor(private readonly base: string, private readonly key: string) {}

  /** The api this terminal talks to: `--api`, else `FROMCODE_API_URL`, else the api on this machine. */
  static connect(apiUrl?: string): RunningPlatformApi {
    const key = EnvUtils.text(RunningPlatformApi.KEY_ENV);
    if (!key) {
      throw new Error(`${RunningPlatformApi.KEY_ENV} is not set. Create an API token for a platform admin in the admin and export it, so this command acts as that admin does.`);
    }
    const base = (apiUrl || EnvUtils.text(RunningPlatformApi.URL_ENV) || `http://localhost:${ReleaseHealthProbe.API_PORT}`).replace(/\/+$/, '');
    return new RunningPlatformApi(base, key);
  }

  async get<T>(segment: string): Promise<T> {
    return this.call<T>('GET', segment);
  }

  async post<T>(segment: string, body: Record<string, unknown> = {}): Promise<T> {
    return this.call<T>('POST', segment, body);
  }

  private async call<T>(method: string, segment: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.base}${ApiPathUtils.versioned(segment)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { 'x-api-key': this.key, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new Error(`The platform api at ${this.base} cannot be reached (${String((error as Error)?.message ?? error)}). Pass --api <url> or set ${RunningPlatformApi.URL_ENV}.`);
    }
    const text = await response.text();
    const data = RunningPlatformApi.parse(text);
    if (!response.ok) {
      const reason = String(data?.message || data?.error || text || response.statusText).trim();
      throw new Error(`${method} ${ApiPathUtils.versioned(segment)} answered ${response.status}: ${reason}`);
    }
    return data as T;
  }

  private static parse(text: string): any {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }
}
