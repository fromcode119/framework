import type { IPluginHealthEntry } from '@core/plugin/services/interfaces/plugin-health-entry.interface';
import type { IPluginHealthEntryInput } from '@core/plugin/services/interfaces/plugin-health-entry-input.interface';
import type { IPluginHealthReport } from '@core/plugin/services/interfaces/plugin-health-report.interface';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHealthBucket } from '@core/plugin/services/enums/plugin-health-bucket.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class PluginHealthReportService {
  static buildReport(inputs: IPluginHealthEntryInput[]): IPluginHealthReport {
    const entries: IPluginHealthEntry[] = (inputs || []).map((p) => {
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
      // Installed newer than running. Both sides must be known: a null `installedVersion` means the
      // manifest could not be read, which is "cannot tell" and must never raise a warning no restart
      // could clear. Equality is enough — a DOWNGRADE on disk is just as unserved as an upgrade.
      const restartPending = Boolean(
        p.runningVersion && p.installedVersion && p.runningVersion !== p.installedVersion,
      );
      return { ...p, addedCapabilities, removedCapabilities, bucket, restartPending };
    });

    const held = entries.filter((e) => e.bucket === PluginHealthBucket.HELD);
    const error = entries.filter((e) => e.bucket === PluginHealthBucket.ERROR);
    const restartPending = entries.filter((e) => e.restartPending);
    const counts = {
      total: entries.length,
      active: entries.filter((e) => e.bucket === PluginHealthBucket.ACTIVE).length,
      held: held.length,
      error: error.length,
      inactive: entries.filter((e) => e.bucket === PluginHealthBucket.INACTIVE).length,
      restartPending: restartPending.length,
    };
    // A pending restart counts against `ok`. The point of this flag is that the screen is lying
    // about what is being served; reporting that state as healthy is the same lie one level up.
    return {
      ok: held.length === 0 && error.length === 0 && restartPending.length === 0,
      counts,
      held,
      error,
      restartPending,
      entries,
    };
  }
}
