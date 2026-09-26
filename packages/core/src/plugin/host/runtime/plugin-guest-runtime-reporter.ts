import type { PluginGuestRegistrar } from '@core/plugin/host/registrations/plugin-guest-registrar';
import type { IPluginGuestRuntimeReport } from '@core/plugin/host/runtime/interfaces/plugin-guest-runtime-report.interface';
import { PluginHostProtocol } from '@core/plugin/host/protocol/plugin-host-protocol';

/** Answers the api's `runtime` request from inside the plugin process. */
export class PluginGuestRuntimeReporter {
  static report(registrar: Pick<PluginGuestRegistrar, 'snapshot'>): IPluginGuestRuntimeReport {
    const memory = process.memoryUsage();
    return {
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      protocolVersion: PluginHostProtocol.VERSION,
      memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal },
      registrations: registrar.snapshot(),
    };
  }
}
