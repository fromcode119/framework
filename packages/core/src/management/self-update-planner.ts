import semver from 'semver';
import { AutomaticUpdatePolicy } from '@core/management/automatic-update-policy';
import { FrameworkReleaseSource } from '@core/management/framework-release-source';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';
import { UpdaterState } from '@core/management/enums/updater-state.enum';
import type { IAutomaticUpdatePlan } from '@core/management/interfaces/automatic-update-plan.interface';

/**
 * The update an image installation should perform now, from the settings an operator controls.
 *
 * Image installations run published images, which are tagged exactly as the framework's releases, so
 * the releases are read from the framework's own tags — a marketplace's "core" entry names no image.
 */
export class SelfUpdatePlanner {
  static async plan(installed: string): Promise<IAutomaticUpdatePlan & { latest: string; automatic: boolean; requested: string }> {
    const pending = await FrameworkReleaseSource.pending(installed);
    const latest = pending.map((release) => release.version).filter((version) => semver.valid(version)).sort(semver.rcompare)[0] || installed;
    // Never saved = the declared default (Settings → Updates shows the same one), not "off".
    const key = SystemConstants.META_KEY.FRAMEWORK_AUTO_UPDATE;
    const automatic = ((await PlatformSettingsService.getSetting(key)) ?? SystemSettingRegistry.defaultValueOf(key)) === 'true';
    const requested = (await PlatformSettingsService.getSetting(SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST)) ?? '';
    const plan = AutomaticUpdatePolicy.decide({ current: installed, latest, automatic, requested, pending, failed: await SelfUpdatePlanner.lastFailed() });
    // Nothing newer found because GitHub did not answer is NOT "up to date"; the screen says which.
    const unknown = plan.reason === AutomaticUpdatePolicy.CURRENT && !(await FrameworkReleaseSource.reachable());
    return { ...plan, reason: unknown ? AutomaticUpdatePolicy.UNKNOWN : plan.reason, latest, automatic, requested };
  }

  /** The version the updater last reported failing or rolling back, from its stored report. */
  private static async lastFailed(): Promise<string> {
    try {
      const status = JSON.parse((await PlatformSettingsService.getSetting(SystemConstants.META_KEY.FRAMEWORK_UPDATE_STATUS)) ?? '');
      return [UpdaterState.FAILED.value, UpdaterState.ROLLED_BACK.value].includes(status?.state) ? String(status?.to ?? '') : '';
    } catch {
      return '';
    }
  }
}
