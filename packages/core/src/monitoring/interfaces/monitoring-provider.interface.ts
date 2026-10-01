import type { IMonitoringIncident } from '@core/monitoring/interfaces/monitoring-incident.interface';
import type { IMonitoringTarget } from '@core/monitoring/interfaces/monitoring-target.interface';
import type { MonitoringChange } from '@core/monitoring/enums/monitoring-change.enum';

/**
 * What a `monitoring` integration provider can do. Both halves are optional: the built-in email
 * provider only delivers incidents, an external uptime service only keeps its own monitors in sync
 * with the platform's addresses (it alerts by itself, which is what covers a server that is down).
 */
export interface IMonitoringProvider {
  /** Deliver an incident that just opened or just resolved. */
  notify?(incident: IMonitoringIncident, change: MonitoringChange): Promise<void>;
  /**
   * Make the provider watch exactly these addresses: add what is missing, remove what it was watching
   * for the platform that is no longer listed. It never touches monitors the platform did not create.
   */
  syncTargets?(targets: IMonitoringTarget[]): Promise<void>;
}
