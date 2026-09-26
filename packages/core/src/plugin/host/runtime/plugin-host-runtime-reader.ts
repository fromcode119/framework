import type { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginProcessHost } from '@core/plugin/host/runtime/enums/plugin-process-host.enum';
import type { IPluginGuestRuntimeReport } from '@core/plugin/host/runtime/interfaces/plugin-guest-runtime-report.interface';
import type { IPluginHostRuntime } from '@core/plugin/host/runtime/interfaces/plugin-host-runtime.interface';

/**
 * Builds what the admin shows about one plugin's process: the api's own facts, plus what the process
 * reports about itself. A process that is running but does not answer is SAID so, with the reason —
 * never shown as if it had nothing registered.
 */
export class PluginHostRuntimeReader {
  static readonly REPORT_TIMEOUT_MS = 5_000;

  static async read(facts: Omit<IPluginHostRuntime, 'hostedBy' | 'report' | 'reportError'>, channel: Pick<PluginChannel, 'request'> | null): Promise<IPluginHostRuntime> {
    const base = { ...facts, hostedBy: String(PluginProcessHost.API.value) };
    if (!facts.running || !channel) return { ...base, report: null, reportError: null };
    try {
      const report = await channel.request('runtime', undefined, PluginHostRuntimeReader.REPORT_TIMEOUT_MS) as IPluginGuestRuntimeReport;
      return { ...base, report, reportError: null };
    } catch (error) {
      return { ...base, report: null, reportError: error instanceof Error ? error.message : String(error) };
    }
  }
}
