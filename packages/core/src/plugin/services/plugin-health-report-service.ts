import type { PluginHealthEntry, PluginHealthEntryInput, PluginHealthReport } from './plugin-health-report.interfaces';
import { PluginRegistryHealth } from './plugin-health.enums';
import { PluginHealthBucket } from './plugin-health.enums';
import { PluginState } from './plugin-state.enums';

export class PluginHealthReportService {
  static buildReport(inputs: PluginHealthEntryInput[]): PluginHealthReport {
    const entries: PluginHealthEntry[] = (inputs || []).map((p) => {
      const manifestCaps = p.manifestCapabilities || [];
      const approvedCaps = p.approvedCapabilities || [];
      const addedCapabilities = manifestCaps.filter((c) => !approvedCaps.includes(c)).sort();
      const removedCapabilities = approvedCaps.filter((c) => !manifestCaps.includes(c)).sort();
      const isHeld = p.healthStatus === PluginRegistryHealth.WARNING || Boolean(p.heldReason);
      const isError = p.state === PluginState.ERROR || p.healthStatus === PluginRegistryHealth.ERROR;
      const bucket: PluginHealthBucket = isError
        ? PluginHealthBucket.ERROR
        : isHeld
          ? PluginHealthBucket.HELD
          : p.state === PluginState.ACTIVE
            ? PluginHealthBucket.ACTIVE
            : PluginHealthBucket.INACTIVE;
      return { ...p, addedCapabilities, removedCapabilities, bucket };
    });

    const held = entries.filter((e) => e.bucket === PluginHealthBucket.HELD);
    const error = entries.filter((e) => e.bucket === PluginHealthBucket.ERROR);
    const counts = {
      total: entries.length,
      active: entries.filter((e) => e.bucket === PluginHealthBucket.ACTIVE).length,
      held: held.length,
      error: error.length,
      inactive: entries.filter((e) => e.bucket === PluginHealthBucket.INACTIVE).length,
    };
    return { ok: held.length === 0 && error.length === 0, counts, held, error, entries };
  }
}
