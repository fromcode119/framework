import { AdminApi } from './api';
import { AdminConstants } from './constants';

export class PluginRuntimeWaitService {
  private static readonly restartDelayMs = 3000;
  private static readonly pollIntervalMs = 1500;
  private static readonly timeoutMs = 60000;
  private static readonly requiredHealthyChecks = 2;

  static async waitForFrameworkRecovery(): Promise<boolean> {
    await PluginRuntimeWaitService.delay(PluginRuntimeWaitService.restartDelayMs);

    const deadline = Date.now() + PluginRuntimeWaitService.timeoutMs;
    let consecutiveHealthyChecks = 0;

    while (Date.now() < deadline) {
      try {
        const health = await AdminApi.get(
          AdminConstants.ENDPOINTS.SYSTEM.HEALTH,
          { noDedupe: true, cache: 'no-store' }
        );

        if (health?.status === 'ok') {
          consecutiveHealthyChecks += 1;
          if (consecutiveHealthyChecks >= PluginRuntimeWaitService.requiredHealthyChecks) {
            return true;
          }
        } else {
          consecutiveHealthyChecks = 0;
        }
      } catch {
        consecutiveHealthyChecks = 0;
      }

      await PluginRuntimeWaitService.delay(PluginRuntimeWaitService.pollIntervalMs);
    }

    return false;
  }

  private static async delay(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
